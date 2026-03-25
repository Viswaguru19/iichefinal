'use client';

import { useState } from 'react';
import { Mail } from 'lucide-react';
import toast from 'react-hot-toast';

export default function TestEmailCard() {
    const [email, setEmail] = useState('');
    const [sending, setSending] = useState(false);

    async function handleSend() {
        if (!email.trim()) {
            toast.error('Enter an email address');
            return;
        }
        setSending(true);
        try {
            const res = await fetch('/api/test-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim() }),
            });
            const data = await res.json();
            if (data.success) {
                toast.success(`Test email sent to ${email}`);
                setEmail('');
            } else {
                toast.error(data.error || 'Failed to send test email');
            }
        } catch {
            toast.error('Failed to send test email');
        } finally {
            setSending(false);
        }
    }

    return (
        <div className="glass rounded-2xl p-6">
            <h2 className="text-xl font-bold text-gradient mb-2 flex items-center gap-2">
                <Mail className="w-5 h-5" /> Test Email
            </h2>
            <p className="text-sm text-gray-500 mb-4">
                Verify that email notifications (Resend API) are working.
            </p>
            <div className="flex gap-2">
                <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter email address"
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                />
                <button
                    onClick={handleSend}
                    disabled={sending}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-sm font-medium disabled:opacity-50 flex items-center gap-2"
                >
                    {sending ? (
                        <>
                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Sending…
                        </>
                    ) : (
                        <>
                            <Mail className="w-4 h-4" />
                            Send Test
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}
