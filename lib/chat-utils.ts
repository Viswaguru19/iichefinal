// ============================================
// CHAT SYSTEM UTILITIES
// WhatsApp-like chat functionality
// ============================================

import { createClient } from '@/lib/supabase/client';
import type { ChatType, ChatGroup, ChatMessage, Profile } from '@/types/database';

// ============================================
// GROUP MANAGEMENT
// ============================================

export async function createChatGroup(
    name: string,
    chatType: ChatType,
    creatorId: string,
    committeeId?: string,
    description?: string,
    participantIds?: string[]
) {
    const supabase = createClient();

    // Create group
    const { data: group, error: groupError } = await supabase
        .from('chat_groups')
        .insert({
            name,
            chat_type: chatType,
            committee_id: committeeId,
            created_by: creatorId,
            description,
        })
        .select()
        .single();

    if (groupError) throw groupError;

    // Add creator as admin participant
    const participants = [
        { group_id: group.id, user_id: creatorId, is_admin: true },
    ];

    // Add other participants
    if (participantIds && participantIds.length > 0) {
        participantIds.forEach((userId) => {
            if (userId !== creatorId) {
                participants.push({
                    group_id: group.id,
                    user_id: userId,
                    is_admin: false,
                });
            }
        });
    }

    const { error: participantsError } = await supabase
        .from('chat_participants')
        .insert(participants);

    if (participantsError) throw participantsError;

    return group;
}

export async function addParticipantsToGroup(
    groupId: string,
    userIds: string[],
    addedBy: string
) {
    const supabase = createClient();

    // Check if addedBy is admin of the group
    const { data: participant } = await supabase
        .from('chat_participants')
        .select('is_admin')
        .eq('group_id', groupId)
        .eq('user_id', addedBy)
        .single();

    if (!participant?.is_admin) {
        throw new Error('Only group admins can add participants');
    }

    const participants = userIds.map((userId) => ({
        group_id: groupId,
        user_id: userId,
        is_admin: false,
    }));

    const { error } = await supabase
        .from('chat_participants')
        .insert(participants);

    if (error) throw error;
}

export async function removeParticipantFromGroup(
    groupId: string,
    userId: string,
    removedBy: string
) {
    const supabase = createClient();

    // Check if removedBy is admin or removing themselves
    if (userId !== removedBy) {
        const { data: participant } = await supabase
            .from('chat_participants')
            .select('is_admin')
            .eq('group_id', groupId)
            .eq('user_id', removedBy)
            .single();

        if (!participant?.is_admin) {
            throw new Error('Only group admins can remove participants');
        }
    }

    const { error } = await supabase
        .from('chat_participants')
        .delete()
        .eq('group_id', groupId)
        .eq('user_id', userId);

    if (error) throw error;
}

// ============================================
// MESSAGE MANAGEMENT
// ============================================

export async function sendMessage(
    groupId: string,
    senderId: string,
    message?: string,
    fileUrl?: string,
    fileType?: string,
    replyTo?: string
) {
    const supabase = createClient();

    // Check if sender is participant
    const { data: participant } = await supabase
        .from('chat_participants')
        .select('id')
        .eq('group_id', groupId)
        .eq('user_id', senderId)
        .single();

    if (!participant) {
        throw new Error('You are not a participant of this group');
    }

    const { data: newMessage, error } = await supabase
        .from('chat_messages')
        .insert({
            group_id: groupId,
            sender_id: senderId,
            message,
            file_url: fileUrl,
            file_type: fileType,
            reply_to: replyTo,
        })
        .select()
        .single();

    if (error) throw error;

    return newMessage;
}

export async function deleteMessage(messageId: string, userId: string) {
    const supabase = createClient();

    // Check if user is the sender
    const { data: message } = await supabase
        .from('chat_messages')
        .select('sender_id')
        .eq('id', messageId)
        .single();

    if (message?.sender_id !== userId) {
        throw new Error('You can only delete your own messages');
    }

    const { error } = await supabase
        .from('chat_messages')
        .update({ is_deleted: true, message: 'This message was deleted' })
        .eq('id', messageId);

    if (error) throw error;
}

export async function markMessageAsRead(messageId: string, userId: string) {
    const supabase = createClient();

    const { error } = await supabase
        .from('message_read_status')
        .upsert({
            message_id: messageId,
            user_id: userId,
            read_at: new Date().toISOString(),
        });

    if (error) throw error;
}

export async function markGroupAsRead(groupId: string, userId: string) {
    const supabase = createClient();

    // Update last_read_at for participant
    const { error } = await supabase
        .from('chat_participants')
        .update({ last_read_at: new Date().toISOString() })
        .eq('group_id', groupId)
        .eq('user_id', userId);

    if (error) throw error;
}

// ============================================
// TYPING INDICATORS
// ============================================

export async function setTypingIndicator(groupId: string, userId: string) {
    const supabase = createClient();

    const { error } = await supabase
        .from('typing_indicators')
        .upsert({
            group_id: groupId,
            user_id: userId,
            started_at: new Date().toISOString(),
        });

    if (error) throw error;
}

export async function removeTypingIndicator(groupId: string, userId: string) {
    const supabase = createClient();

    const { error } = await supabase
        .from('typing_indicators')
        .delete()
        .eq('group_id', groupId)
        .eq('user_id', userId);

    if (error) throw error;
}

export async function getTypingUsers(groupId: string): Promise<Profile[]> {
    const supabase = createClient();

    // Get typing indicators from last 5 seconds
    const fiveSecondsAgo = new Date(Date.now() - 5000).toISOString();

    const { data, error } = await supabase
        .from('typing_indicators')
        .select('user_id, profiles(id, name, avatar_url)')
        .eq('group_id', groupId)
        .gte('started_at', fiveSecondsAgo);

    if (error) throw error;

    return (data || []).map((item: any) => item.profiles).filter(Boolean);
}

// ============================================
// FETCH MESSAGES
// ============================================

export async function getGroupMessages(
    groupId: string,
    limit: number = 50,
    before?: string
) {
    const supabase = createClient();

    let query = supabase
        .from('chat_messages')
        .select(`
      *,
      sender:profiles!chat_messages_sender_id_fkey(id, name, avatar_url),
      reply_to_message:chat_messages!chat_messages_reply_to_fkey(id, message, sender_id)
    `)
        .eq('group_id', groupId)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (before) {
        query = query.lt('created_at', before);
    }

    const { data, error } = await query;

    if (error) throw error;

    return (data || []).reverse();
}

export async function getUserGroups(userId: string) {
    const supabase = createClient();

    const { data, error } = await supabase
        .from('chat_participants')
        .select(`
      *,
      group:chat_groups(
        *,
        last_message:chat_messages(
          id,
          message,
          created_at,
          sender:profiles(name)
        )
      )
    `)
        .eq('user_id', userId)
        .order('last_read_at', { ascending: false });

    if (error) throw error;

    return data || [];
}

export async function getUnreadCount(groupId: string, userId: string): Promise<number> {
    const supabase = createClient();

    // Get participant's last read time
    const { data: participant } = await supabase
        .from('chat_participants')
        .select('last_read_at')
        .eq('group_id', groupId)
        .eq('user_id', userId)
        .single();

    if (!participant) return 0;

    // Count messages after last read
    const { count, error } = await supabase
        .from('chat_messages')
        .select('id', { count: 'exact', head: true })
        .eq('group_id', groupId)
        .gt('created_at', participant.last_read_at)
        .neq('sender_id', userId);

    if (error) throw error;

    return count || 0;
}

// ============================================
// SEARCH MESSAGES
// ============================================

export async function searchMessages(groupId: string, query: string) {
    const supabase = createClient();

    const { data, error } = await supabase
        .from('chat_messages')
        .select(`
      *,
      sender:profiles(id, name, avatar_url)
    `)
        .eq('group_id', groupId)
        .ilike('message', `%${query}%`)
        .order('created_at', { ascending: false })
        .limit(50);

    if (error) throw error;

    return data || [];
}

// ============================================
// PREDEFINED GROUP CREATION
// ============================================

export async function createOrganizationChat() {
    const supabase = createClient();

    // Get all active users
    const { data: users } = await supabase
        .from('profiles')
        .select('id')
        .eq('is_active', true);

    if (!users) throw new Error('No users found');

    const userIds = users.map((u) => u.id);

    return createChatGroup(
        'IIChE AVVU - Organization',
        'organization',
        userIds[0], // First user as creator
        undefined,
        'Organization-wide chat for all members',
        userIds
    );
}

export async function createExecutiveChat() {
    const supabase = createClient();

    // Get all EC members
    const { data: ecMembers } = await supabase
        .from('profiles')
        .select('id')
        .not('executive_role', 'is', null)
        .eq('is_active', true);

    if (!ecMembers) throw new Error('No EC members found');

    const userIds = ecMembers.map((u) => u.id);

    return createChatGroup(
        'Executive Committee',
        'executive',
        userIds[0],
        undefined,
        'Private chat for Executive Committee members',
        userIds
    );
}

export async function createCoHeadsChat() {
    const supabase = createClient();

    // Get all co-heads
    const { data: coHeads } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'committee_cohead')
        .eq('is_active', true);

    if (!coHeads) throw new Error('No co-heads found');

    const userIds = coHeads.map((u) => u.id);

    return createChatGroup(
        'Committee Co-Heads',
        'coheads',
        userIds[0],
        undefined,
        'Private chat for all Committee Co-Heads',
        userIds
    );
}

export async function createCommitteeChat(committeeId: string, committeeName: string) {
    const supabase = createClient();

    // Get all committee members
    const { data: members } = await supabase
        .from('committee_members')
        .select('user_id')
        .eq('committee_id', committeeId);

    if (!members) throw new Error('No committee members found');

    const userIds = members.map((m) => m.user_id);

    return createChatGroup(
        `${committeeName} Committee`,
        'committee',
        userIds[0],
        committeeId,
        `Private chat for ${committeeName} committee members`,
        userIds
    );
}
