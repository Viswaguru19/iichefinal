'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { X, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

interface RevokeModalProps {
    event: any;
    onClose: () => void;
    onSuccess: () => void;
}

export default function RevokeModal({ event, onClose, onSuccess }: RevokeModalProps) {
    const [revokeReason, setRevokeReason] = useState('');
    const [loading, setLoading] = useState(false);
    const supabase = createClient();

    async function handleRevoke() {
        if (!revokeReason.trim()) {
            toast.error('Please provide a reason for revoking the rejection');
            return;
        }

        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();

            const { error } = await supabase
                .from('events')
                .update({
                    status: 'pending_ec_approval',
                    ec_revoke_reason: revokeReason,
                    ec_revoked_by: user?.id,
                    ec_revoked_at: new Date().toISOString()
                })
                .eq('id', event.id);

            if (error) throw error;

            toast.success('Rejection revoked. Event moved to EC approval.');
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
            <div className="bg-white rounded-xl p-6 max-w-md w-full">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-gray-900">Revoke Head Rejection</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-start gap-2">
                        <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                        <div>
                            <p className="text-sm font-medium text-yellow-900">Original Rejection Reason:</p>
                            <p className="text-sm text-yellow-800 mt-1">{event.head_rejection_reason}</p>
                        </div>
                    </div>
                </div>

                <p className="text-sm text-gray-600 mb-4">
                    As an EC member, you can override the committee head's rejection and move this event to EC approval stage.
                </p>

                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Revoke Reason <span className="text-red-500">*</span>
                    </label>
                    <textarea
                        value={revokeReason}
                        onChange={(e) => setRevokeReason(e.target.value)}
                        rows={4}
                        required
                        placeholder="Explain why you're overriding the head's decision..."
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    />
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={handleRevoke}
                        disabled={loading || !revokeReason.trim()}
                        className="flex-1 bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 disabled:opacity-50"
                    >
                        {loading ? 'Revoking...' : 'Revoke & Review'}
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
