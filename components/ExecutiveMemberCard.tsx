'use client';

import { createClient } from '@/lib/supabase/client';
import { Crown, Star } from 'lucide-react';
import ChatButton from '@/components/ChatButton';

export default function ExecutiveMemberCard({ member, showChat, icon }: { 
  member: any; 
  showChat: boolean;
  icon?: 'crown' | 'star';
}) {
  const supabase = createClient();
  const avatarUrl = member.avatar_url 
    ? supabase.storage.from('avatars').getPublicUrl(member.avatar_url).data.publicUrl
    : null;

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex items-start gap-4 mb-4">
        {avatarUrl ? (
          <img src={avatarUrl} alt={member.name} className="w-16 h-16 rounded-full object-cover" />
        ) : (
          <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center text-white text-2xl font-bold">
            {member.name?.charAt(0)}
          </div>
        )}
        <div className="flex-1">
          <h3 className="text-xl font-bold text-gray-900">{member.name}</h3>
          <p className="text-sm text-blue-600 font-semibold mt-1">
            {member.executive_role?.replace(/_/g, ' ').toUpperCase()}
          </p>
          <p className="text-sm text-gray-500 mt-1">{member.email}</p>
        </div>
        {icon === 'star' ? (
          <Star className="w-6 h-6 text-blue-500" />
        ) : (
          <Crown className="w-6 h-6 text-yellow-500" />
        )}
      </div>
      {showChat && (
        <ChatButton userId={member.id} userName={member.name} />
      )}
    </div>
  );
}
