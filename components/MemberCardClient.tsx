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
      className="bg-white rounded-lg shadow-md p-6 flex items-center gap-4 hover:shadow-xl transition"
    >
      {avatarUrl ? (
        <img src={avatarUrl} alt={member.profile?.name} className="w-16 h-16 rounded-full object-cover" />
      ) : (
        <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center text-white text-2xl font-bold">
          {member.profile?.name?.charAt(0)}
        </div>
      )}
      <div>
        <h3 className="text-lg font-bold text-gray-900">{member.profile?.name}</h3>
        {member.designation && (
          <p className="text-sm text-gray-600 mt-1">{member.designation}</p>
        )}
        <p className="text-sm text-gray-500 mt-1">{member.profile?.email}</p>
      </div>
    </Link>
  );
}
