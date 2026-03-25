'use client';

import { motion } from 'framer-motion';
import { X, Mail, Phone, Building, Award, Calendar, Shield } from 'lucide-react';
import type { UserProfile } from '@/app/dashboard/chat/page';

interface Props {
    user: UserProfile;
    isOnline: boolean;
    onClose: () => void;
}

export default function ProfilePanel({ user, isOnline, onClose }: Props) {
    return (
        <motion.div
            initial={{ x: 400, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 400, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="w-[340px] bg-white border-l border-gray-200 flex flex-col h-full overflow-y-auto"
        >
            {/* Header */}
            <div className="px-4 py-3 bg-[#f0f2f5] flex items-center gap-3 border-b border-gray-200">
                <button onClick={onClose} className="text-gray-500 hover:text-gray-700 transition-colors">
                    <X className="w-5 h-5" />
                </button>
                <h3 className="font-semibold text-gray-800">Contact Info</h3>
            </div>

            {/* Avatar + Name */}
            <div className="flex flex-col items-center py-8 bg-[#f0f2f5]">
                <div className="relative mb-4">
                    {user.avatar_url ? (
                        <img src={user.avatar_url} alt="" className="w-24 h-24 rounded-full object-cover shadow-lg" />
                    ) : (
                        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-3xl font-bold shadow-lg">
                            {user.name[0]?.toUpperCase()}
                        </div>
                    )}
                    {isOnline && (
                        <div className="absolute bottom-1 right-1 w-5 h-5 bg-emerald-500 rounded-full border-3 border-white shadow-md" />
                    )}
                </div>
                <h2 className="text-xl font-bold text-gray-900">{user.name}</h2>
                <p className="text-sm text-gray-500 mt-0.5">{isOnline ? '🟢 Online' : '⚪ Offline'}</p>
            </div>

            {/* Info Cards */}
            <div className="p-4 space-y-4">
                {user.email && (
                    <InfoRow icon={<Mail className="w-4 h-4" />} label="Email" value={user.email} />
                )}
                {user.phone && (
                    <InfoRow icon={<Phone className="w-4 h-4" />} label="Phone" value={user.phone} />
                )}
                {user.department && (
                    <InfoRow icon={<Building className="w-4 h-4" />} label="Department" value={user.department} />
                )}
                {user.committee_name && (
                    <InfoRow icon={<Shield className="w-4 h-4" />} label="Committee" value={user.committee_name} />
                )}
                {user.committee_position && (
                    <InfoRow icon={<Award className="w-4 h-4" />} label="Position" value={user.committee_position.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} />
                )}
                <InfoRow
                    icon={<Shield className="w-4 h-4" />}
                    label="Role"
                    value={user.is_faculty ? 'Faculty Advisor' : (user.executive_role || user.role)?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Member'}
                />
                <InfoRow
                    icon={<Calendar className="w-4 h-4" />}
                    label="Joined"
                    value={new Date(user.created_at).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                />
            </div>
        </motion.div>
    );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
    return (
        <div className="flex items-start gap-3 py-2 border-b border-gray-50">
            <div className="text-indigo-400 mt-0.5">{icon}</div>
            <div>
                <p className="text-xs text-gray-400">{label}</p>
                <p className="text-sm text-gray-800 font-medium">{value}</p>
            </div>
        </div>
    );
}
