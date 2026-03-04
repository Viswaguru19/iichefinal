'use client';

import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function MemberCardClient({ member }: { member: any }) {
  const supabase = createClient();
  const avatarUrl = member.profile?.avatar_url
    ? supabase.storage.from('avatars').getPublicUrl(member.profile.avatar_url).data.publicUrl
    : null;

  return (
    <Link
      href={`/profile/${member.profile?.id}`}
      className="bg-white rounded-xl shadow-md p-6 hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 block"
    >
      <div className="flex flex-col items-center text-center">
        {/* Profile Photo - 5cm x 5cm (192px) */}
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={member.profile?.name}
            className="w-48 h-48 rounded-lg object-cover mb-4 border-4 border-blue-100 shadow-lg"
          />
        ) : (
          <div className="w-48 h-48 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-6xl font-bold mb-4 border-4 border-blue-100 shadow-lg">
            {member.profile?.name?.charAt(0)}
          </div>
        )}

        {/* Member Info */}
        <h3 className="text-xl font-bold text-gray-900 mb-1">{member.profile?.name}</h3>

        {member.designation && (
          <p className="text-sm font-medium text-blue-600 mb-2">{member.designation}</p>
        )}

        <p className="text-sm text-gray-500 mb-3">{member.profile?.email}</p>

        {/* Description */}
        {member.profile?.description && (
          <p className="text-sm text-gray-600 line-clamp-3 mt-2 px-2">
            {member.profile.description}
          </p>
        )}

        {/* View Profile Link */}
        <div className="mt-4 text-blue-600 text-sm font-medium hover:text-blue-700">
          View Full Profile →
        </div>
      </div>
    </Link>
  );
}
