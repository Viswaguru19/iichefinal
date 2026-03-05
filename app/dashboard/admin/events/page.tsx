'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Edit, Trash2, Calendar, MapPin } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminEventsPage() {
    const [events, setEvents] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState<any>(null);
    const [editForm, setEditForm] = useState({
        title: '',
        description: '',
        date: '',
        location: '',
        budget: '',
        status: ''
    });
    const supabase = createClient();
    const router = useRouter();

    useEffect(() => {
        checkAccess();
        loadEvents();
    }, []);

    async function checkAccess() {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return router.push('/login');

        const { data: profile } = await supabase
            .from('profiles')
            .select('is_admin, role')
            .eq('id', user.id)
            .single();

        if (!profile || (!profile.is_admin && profile.role !== 'super_admin')) {
            toast.error('Access denied: Admin only');
            return router.push('/dashboard');
        }
    }

    async function loadEvents() {
        const { data } = await supabase
            .from('events')
            .select(`
        *,
        committee:committees(name),
        proposer:profiles!events_proposed_by_fkey(name)
      `)
            .order('created_at', { ascending: false });

        setEvents(data || []);
    }

    async function handleDelete() {
        if (!selectedEvent) return;

        setLoading(true);
        try {
            // Delete associated tasks first
            await supabase.from('tasks').delete().eq('event_id', selectedEvent.id);

            // Delete EC approvals
            await supabase.from('ec_approvals').delete().eq('event_id', selectedEvent.id);

            // Delete event
            const { error } = await supabase
                .from('events')
                .delete()
                .eq('id', selectedEvent.id);

            if (error) throw error;

            toast.success('Event deleted successfully');
            setShowDeleteModal(false);
            setSelectedEvent(null);
            loadEvents();
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    }

    async function handleEdit(e: React.FormEvent) {
        e.preventDefault();
        if (!selectedEvent) return;

        setLoading(true);
        try {
            const { error } = await supabase
                .from('events')
                .update({
                    title: editForm.title,
                    description: editForm.description,
                    date: editForm.date,
                    location: editForm.location,
                    budget: editForm.budget ? parseFloat(editForm.budget) : null,
                    status: editForm.status
                })
                .eq('id', selectedEvent.id);

            if (error) throw error;

            toast.success('Event updated successfully');
            setShowEditModal(false);
            setSelectedEvent(null);
            loadEvents();
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    }

    function openEditModal(event: any) {
        setSelectedEvent(event);
        setEditForm({
            title: event.title || '',
            description: event.description || '',
            date: event.date ? new Date(event.date).toISOString().slice(0, 16) : '',
            location: event.location || '',
            budget: event.budget?.toString() || '',
            status: event.status || ''
        });
        setShowEditModal(true);
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <nav className="bg-white shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16 items-center">
                        <h1 className="text-2xl font-bold text-blue-600">Admin - All Events</h1>
                        <button onClick={() => router.back()} className="text-gray-600 hover:text-blue-600">← Back</button>
                    </div>
                </div>
            </nav>

            <div className="max-w-7xl mx-auto px-4 py-8">
                <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b">
                                <tr>
                                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Title</th>
                                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Committee</th>
                                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Proposer</th>
                                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Date</th>
                                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {events.map((event) => (
                                    <tr key={event.id} className="border-b hover:bg-gray-50">
                                        <td className="py-3 px-4">
                                            <p className="font-medium text-gray-900">{event.title}</p>
                                            {event.description && (
                                                <p className="text-sm text-gray-600 line-clamp-1">{event.description}</p>
                                            )}
                                        </td>
                                        <td className="py-3 px-4 text-sm text-gray-600">{event.committee?.name}</td>
                                        <td className="py-3 px-4 text-sm text-gray-600">{event.proposer?.name}</td>
                                        <td className="py-3 px-4 text-sm text-gray-600">
                                            {new Date(event.date).toLocaleDateString('en-IN')}
                                        </td>
                                        <td className="py-3 px-4">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${event.status === 'active' ? 'bg-green-100 text-green-800' :
                                                    event.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                                                        event.status === 'pending_ec_approval' ? 'bg-blue-100 text-blue-800' :
                                                            event.status === 'rejected_by_head' ? 'bg-red-100 text-red-800' :
                                                                'bg-yellow-100 text-yellow-800'
                                                }`}>
                                                {event.status.replace(/_/g, ' ').toUpperCase()}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4">
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => openEditModal(event)}
                                                    className="text-blue-600 hover:text-blue-700 p-2 hover:bg-blue-50 rounded"
                                                    title="Edit event"
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setSelectedEvent(event);
                                                        setShowDeleteModal(true);
                                                    }}
                                                    className="text-red-600 hover:text-red-700 p-2 hover:bg-red-50 rounded"
                                                    title="Delete event"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {events.length === 0 && (
                        <div className="text-center py-12 text-gray-500">
                            <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                            <p>No events found</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Delete Modal */}
            {showDeleteModal && selectedEvent && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl p-6 max-w-md w-full">
                        <h2 className="text-xl font-bold text-red-600 mb-4">Delete Event</h2>
                        <p className="text-gray-700 mb-4">
                            Are you sure you want to delete <span className="font-bold">"{selectedEvent.title}"</span>?
                        </p>
                        <p className="text-sm text-red-600 mb-6">
                            This will permanently delete the event and all associated tasks. This action cannot be undone.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={handleDelete}
                                disabled={loading}
                                className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50"
                            >
                                {loading ? 'Deleting...' : 'Delete Event'}
                            </button>
                            <button
                                onClick={() => {
                                    setShowDeleteModal(false);
                                    setSelectedEvent(null);
                                }}
                                disabled={loading}
                                className="flex-1 bg-gray-200 text-gray-900 px-4 py-2 rounded-lg hover:bg-gray-300 disabled:opacity-50"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {showEditModal && selectedEvent && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <h2 className="text-2xl font-bold text-gray-900 mb-6">Edit Event</h2>
                        <form onSubmit={handleEdit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                                <input
                                    type="text"
                                    value={editForm.title}
                                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                                    required
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                <textarea
                                    value={editForm.description}
                                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                                    rows={4}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Date & Time</label>
                                <input
                                    type="datetime-local"
                                    value={editForm.date}
                                    onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                                    required
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                                <input
                                    type="text"
                                    value={editForm.location}
                                    onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Budget (₹)</label>
                                <input
                                    type="number"
                                    value={editForm.budget}
                                    onChange={(e) => setEditForm({ ...editForm, budget: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                                <select
                                    value={editForm.status}
                                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                                    required
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                                >
                                    <option value="pending_head_approval">Pending Head Approval</option>
                                    <option value="pending_ec_approval">Pending EC Approval</option>
                                    <option value="rejected_by_head">Rejected by Head</option>
                                    <option value="active">Active</option>
                                    <option value="cancelled">Cancelled</option>
                                </select>
                            </div>

                            <div className="flex gap-3 mt-6">
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                                >
                                    {loading ? 'Saving...' : 'Save Changes'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowEditModal(false);
                                        setSelectedEvent(null);
                                    }}
                                    disabled={loading}
                                    className="flex-1 bg-gray-200 text-gray-900 px-4 py-2 rounded-lg hover:bg-gray-300 disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
