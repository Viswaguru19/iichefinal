'use client';

import { motion } from 'framer-motion';
import { X, Mail, Phone, Building, Award, Calendar, Shield } from 'lucide-react';
import type { UserProfile } from '@/components/chat/types';

interface Props {
  user: UserProfile;
  isOnline: boolean;
  onClose: () => void;
}

export default function ProfilePanel({ user, isOnline, onClose }: Props) {
  return (
    <>
      <motion.button
        type="button"
        aria-label="Close profile"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/40 z-40 sm:hidden"
      />
      <motion.aside
        initial={{ x: '100%', opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: '100%', opacity: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 32 }}
        className="fixed inset-y-0 right-0 w-full max-w-sm sm:relative sm:inset-auto sm:w-[340px] sm:max-w-none bg-white border-l border-gray-200 flex flex-col h-full overflow-y-auto z-50 sm:z-auto shadow-2xl sm:shadow-none pb-[env(safe-area-inset-bottom)]"
      >
        <div className="px-4 py-3 bg-[#f0f2f5] flex items-center gap-3 border-b border-gray-200 sticky top-0 z-10">
          <button type="button" onClick={onClose} className="text-gray-500 hover:text-gray-700 transition-colors p-1">
            <X className="w-5 h-5" />
          </button>
          <h3 className="font-semibold text-gray-800">Contact Info</h3>
        </div>

        <div className="flex flex-col items-center py-8 bg-[#f0f2f5]">
          <div className="relative mb-4">
            {user.avatar_url ? (
              <img src={user.avatar_url} alt="" className="w-24 h-24 rounded-full object-cover shadow-lg" />
            ) : (
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-3xl font-bold shadow-lg">
                {(user.name || '?')[0]?.toUpperCase()}
              </div>
            )}
            {isOnline && (
              <div className="absolute bottom-1 right-1 w-5 h-5 bg-emerald-500 rounded-full border-[3px] border-white shadow-md" />
            )}
          </div>
          <h2 className="text-xl font-bold text-gray-900 px-4 text-center">{user.name || 'User'}</h2>
          <p className="text-sm text-gray-500 mt-0.5">{isOnline ? 'Online' : 'Offline'}</p>
        </div>

        <div className="p-4 space-y-4">
          {user.email && <InfoRow icon={<Mail className="w-4 h-4" />} label="Email" value={user.email} />}
          {user.phone && <InfoRow icon={<Phone className="w-4 h-4" />} label="Phone" value={user.phone} />}
          {user.department && <InfoRow icon={<Building className="w-4 h-4" />} label="Department" value={user.department} />}
          {user.committee_name && <InfoRow icon={<Shield className="w-4 h-4" />} label="Committee" value={user.committee_name} />}
          {user.committee_position && (
            <InfoRow
              icon={<Award className="w-4 h-4" />}
              label="Position"
              value={user.committee_position.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
            />
          )}
          <InfoRow
            icon={<Shield className="w-4 h-4" />}
            label="Role"
            value={
              user.is_faculty
                ? 'Faculty Advisor'
                : (user.executive_role || user.role)?.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()) || 'Member'
            }
          />
          <InfoRow
            icon={<Calendar className="w-4 h-4" />}
            label="Joined"
            value={new Date(user.created_at).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
          />
        </div>
      </motion.aside>
    </>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-gray-50">
      <div className="text-indigo-400 mt-0.5 shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-sm text-gray-800 font-medium break-words">{value}</p>
      </div>
    </div>
  );
}
