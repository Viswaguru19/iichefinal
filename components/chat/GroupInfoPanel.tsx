'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { motion } from 'framer-motion';
import { Camera, Check, LogOut, Pencil, Plus, Search, Shield, ShieldOff, Trash2, Users, X } from 'lucide-react';
import toast from 'react-hot-toast';
import type { ChatItem, UserProfile } from '@/components/chat/types';

type ParticipantRow = { id: string; name: string; avatar_url: string | null; is_group_admin: boolean };

interface Props {
  chat: ChatItem;
  currentUser: UserProfile;
  allUsers: UserProfile[];
  onlineUsers: Set<string>;
  showOnlinePresence: boolean;
  onClose: () => void;
  onOpenProfile: (userId: string) => void;
  onMetaUpdated: (patch: Partial<ChatItem>) => void;
  onLeftOrDeleted: () => void;
}

export default function GroupInfoPanel({
  chat,
  currentUser,
  allUsers,
  onlineUsers,
  showOnlinePresence,
  onClose,
  onOpenProfile,
  onMetaUpdated,
  onLeftOrDeleted,
}: Props) {
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [participants, setParticipants] = useState<ParticipantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [iAmAdmin, setIAmAdmin] = useState(false);
  const [description, setDescription] = useState(chat.description || '');
  const [savingDesc, setSavingDesc] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [groupName, setGroupName] = useState(chat.name || '');
  const [savingName, setSavingName] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [roleBusyId, setRoleBusyId] = useState<string | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);

  const canManage = chat.groupChatType === 'custom_group' && iAmAdmin;
  const adminCount = participants.filter((p) => p.is_group_admin).length;
  const memberIds = new Set(participants.map((p) => p.id));
  const addCandidates = allUsers.filter(
    (u) => !memberIds.has(u.id) && (u.name ?? '').toLowerCase().includes(userSearch.toLowerCase()),
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!chat.participantGroupId) return;
      setLoading(true);
      const { data: rows } = await supabase
        .from('chat_participants')
        .select('user_id, is_admin')
        .eq('group_id', chat.participantGroupId);
      const adminMap = Object.fromEntries((rows || []).map((r: { user_id: string; is_admin: boolean }) => [r.user_id, r.is_admin]));
      const myAdmin = !!(rows || []).find((r: { user_id: string }) => r.user_id === currentUser.id && adminMap[r.user_id]);
      const ids = [...new Set((rows || []).map((r: { user_id: string }) => r.user_id))];
      const { data: profs } = ids.length
        ? await supabase.from('profiles').select('id, name, avatar_url').in('id', ids)
        : { data: [] as { id: string; name: string; avatar_url: string | null }[] };
      const list: ParticipantRow[] = (profs || [])
        .map((p) => ({
          id: p.id,
          name: p.name,
          avatar_url: p.avatar_url,
          is_group_admin: !!adminMap[p.id],
        }))
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      if (!cancelled) {
        setIAmAdmin(myAdmin);
        setParticipants(list);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [chat.participantGroupId, currentUser.id]);

  async function saveName() {
    if (!chat.participantGroupId || !canManage) return;
    const trimmed = groupName.trim();
    if (!trimmed) {
      toast.error('Group name cannot be empty');
      return;
    }
    setSavingName(true);
    const { error } = await supabase
      .from('chat_groups')
      .update({ name: trimmed })
      .eq('id', chat.participantGroupId);
    setSavingName(false);
    if (error) {
      toast.error(error.message || 'Could not rename group');
      return;
    }
    onMetaUpdated({ name: trimmed });
    setEditingName(false);
    toast.success('Group renamed');
  }

  async function saveDescription() {
    if (!chat.participantGroupId || !canManage) return;
    setSavingDesc(true);
    const { error } = await supabase
      .from('chat_groups')
      .update({ description: description.trim() || null })
      .eq('id', chat.participantGroupId);
    setSavingDesc(false);
    if (error) {
      toast.error(error.message || 'Could not save description');
      return;
    }
    onMetaUpdated({ description: description.trim() || null });
    toast.success('Description updated');
  }

  async function uploadAvatar(file: File) {
    if (!chat.participantGroupId || !canManage) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Max 5MB for group photo');
      return;
    }
    setAvatarBusy(true);
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `chat-avatars/${chat.participantGroupId}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('documents').upload(path, file);
    if (upErr) {
      setAvatarBusy(false);
      toast.error(upErr.message);
      return;
    }
    const { data } = supabase.storage.from('documents').getPublicUrl(path);
    const { error } = await supabase.from('chat_groups').update({ avatar_url: data.publicUrl }).eq('id', chat.participantGroupId);
    setAvatarBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    onMetaUpdated({ avatar: data.publicUrl });
    toast.success('Group photo updated');
  }

  async function addMember(userId: string) {
    if (!chat.participantGroupId || !canManage) return;
    const { error } = await supabase.from('chat_participants').insert({
      group_id: chat.participantGroupId,
      user_id: userId,
      is_admin: false,
    });
    if (error) {
      toast.error(error.message || 'Could not add member');
      return;
    }
    const user = allUsers.find((u) => u.id === userId);
    if (user) {
      setParticipants((prev) =>
        [...prev, { id: user.id, name: user.name, avatar_url: user.avatar_url, is_group_admin: false }].sort((a, b) =>
          (a.name || '').localeCompare(b.name || ''),
        ),
      );
    }
    toast.success('Member added');
  }

  async function removeMember(userId: string) {
    if (!chat.participantGroupId || userId === currentUser.id) return;
    setRemovingId(userId);
    const { data, error } = await supabase
      .from('chat_participants')
      .delete()
      .eq('group_id', chat.participantGroupId)
      .eq('user_id', userId)
      .select('user_id');
    setRemovingId(null);
    if (error || !data?.length) {
      toast.error(error?.message || 'Could not remove member');
      return;
    }
    setParticipants((prev) => prev.filter((p) => p.id !== userId));
    toast.success('Member removed');
  }

  async function setMemberAdmin(userId: string, makeAdmin: boolean) {
    if (!chat.participantGroupId || !canManage || userId === currentUser.id) return;
    if (!makeAdmin && adminCount <= 1) {
      toast.error('Promote someone else before dismissing the last admin');
      return;
    }
    setRoleBusyId(userId);
    const { data, error } = await supabase
      .from('chat_participants')
      .update({ is_admin: makeAdmin })
      .eq('group_id', chat.participantGroupId)
      .eq('user_id', userId)
      .select('user_id');
    setRoleBusyId(null);
    if (error || !data?.length) {
      toast.error(error?.message || (makeAdmin ? 'Could not promote' : 'Could not demote'));
      return;
    }
    setParticipants((prev) =>
      prev.map((p) => (p.id === userId ? { ...p, is_group_admin: makeAdmin } : p)),
    );
    toast.success(makeAdmin ? 'Made group admin' : 'Removed as admin');
  }

  async function leaveGroup() {
    if (!chat.participantGroupId) return;
    if (iAmAdmin && adminCount <= 1 && participants.length > 1) {
      toast.error('Promote another admin before leaving');
      return;
    }
    if (!confirm('Leave this group?')) return;
    const { error } = await supabase
      .from('chat_participants')
      .delete()
      .eq('group_id', chat.participantGroupId)
      .eq('user_id', currentUser.id);
    if (error) {
      toast.error(error.message || 'Could not leave');
      return;
    }
    toast.success('Left group');
    onLeftOrDeleted();
  }

  async function deleteGroup() {
    if (!chat.participantGroupId || !canManage) return;
    if (!confirm('Delete this group for everyone?')) return;
    const { error } = await supabase.from('chat_groups').delete().eq('id', chat.participantGroupId);
    if (error) {
      toast.error(error.message || 'Could not delete group');
      return;
    }
    toast.success('Group deleted');
    onLeftOrDeleted();
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[55] bg-black/50 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 24, opacity: 0 }}
        transition={{ duration: 0.14 }}
        className="bg-[#111b21] w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[90dvh] flex flex-col border border-[#2a3942] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-[#2a3942] flex items-center justify-between bg-[#202c33]">
          <h2 className="text-white font-semibold">Group info</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white p-1" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-4 space-y-5">
          <div className="flex flex-col items-center text-center">
            <div className="relative mb-3">
              {chat.avatar ? (
                <img src={chat.avatar} alt="" className="w-24 h-24 rounded-full object-cover" />
              ) : (
                <div className="w-24 h-24 rounded-full bg-[#00a884] flex items-center justify-center text-white">
                  <Users className="w-10 h-10" />
                </div>
              )}
              {canManage && (
                <button
                  type="button"
                  disabled={avatarBusy}
                  onClick={() => fileRef.current?.click()}
                  className="absolute bottom-0 right-0 w-9 h-9 rounded-full bg-[#00a884] text-white flex items-center justify-center shadow-lg disabled:opacity-50"
                  title="Change group photo"
                >
                  <Camera className="w-4 h-4" />
                </button>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void uploadAvatar(f);
                  e.target.value = '';
                }}
              />
            </div>
            {editingName && canManage ? (
              <div className="flex items-center gap-2 w-full max-w-xs">
                <input
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void saveName();
                    if (e.key === 'Escape') {
                      setGroupName(chat.name || '');
                      setEditingName(false);
                    }
                  }}
                  autoFocus
                  maxLength={80}
                  className="flex-1 min-w-0 bg-[#202c33] rounded-lg px-3 py-1.5 text-base font-semibold text-white text-center outline-none focus:ring-1 focus:ring-emerald-500/40"
                />
                <button
                  type="button"
                  disabled={savingName}
                  onClick={() => void saveName()}
                  className="p-1.5 rounded-lg text-[#00a884] hover:bg-[#202c33] disabled:opacity-50 shrink-0"
                  aria-label="Save name"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setGroupName(chat.name || '');
                    setEditingName(false);
                  }}
                  className="p-1.5 rounded-lg text-gray-400 hover:bg-[#202c33] shrink-0"
                  aria-label="Cancel rename"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 max-w-full">
                <h3 className="text-xl font-semibold text-white truncate">{chat.name}</h3>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => setEditingName(true)}
                    className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-[#202c33] shrink-0"
                    title="Rename group"
                    aria-label="Rename group"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
            <p className="text-xs text-gray-500 mt-1">{participants.length} participants</p>
            {chat.groupChatType === 'custom_group' && !iAmAdmin && !loading && (
              <p className="text-[10px] text-gray-500 mt-0.5">Only group admins can edit the name, photo and description.</p>
            )}
          </div>

          <div>
            <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-1">Description</p>
            {canManage ? (
              <div className="space-y-2">
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="Add group description"
                  className="w-full bg-[#202c33] rounded-xl px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-emerald-500/40 resize-none"
                />
                <button
                  type="button"
                  onClick={() => void saveDescription()}
                  disabled={savingDesc}
                  className="text-sm font-semibold text-[#00a884] disabled:opacity-50"
                >
                  {savingDesc ? 'Saving…' : 'Save description'}
                </button>
              </div>
            ) : (
              <p className="text-sm text-gray-300 bg-[#202c33] rounded-xl px-3 py-2 min-h-[2.5rem]">
                {chat.description?.trim() || 'No description'}
              </p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] uppercase tracking-wide text-gray-500">{participants.length} members</p>
              {canManage && (
                <button
                  type="button"
                  onClick={() => setShowAdd((v) => !v)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#00a884]"
                >
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              )}
            </div>

            {showAdd && canManage && (
              <div className="mb-3 rounded-xl border border-[#2a3942] bg-[#202c33] overflow-hidden">
                <div className="relative px-2 py-2 border-b border-[#2a3942]">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                  <input
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Search people to add…"
                    className="w-full pl-8 pr-2 py-1.5 bg-transparent text-sm text-white outline-none"
                  />
                </div>
                <div className="max-h-40 overflow-y-auto">
                  {addCandidates.slice(0, 20).map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => void addMember(u.id)}
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[#2a3942] text-left"
                    >
                      <span className="text-sm text-white truncate">{u.name}</span>
                      <Plus className="w-3.5 h-3.5 text-[#00a884] ml-auto shrink-0" />
                    </button>
                  ))}
                  {addCandidates.length === 0 && <p className="text-xs text-gray-500 px-3 py-3">No users found</p>}
                </div>
              </div>
            )}

            {loading ? (
              <p className="text-sm text-gray-500 text-center py-4">Loading…</p>
            ) : (
              <ul className="space-y-1">
                {participants.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-[#202c33]">
                    <button
                      type="button"
                      className="flex items-center gap-3 flex-1 min-w-0 text-left"
                      onClick={() => {
                        if (p.id !== currentUser.id) {
                          onClose();
                          onOpenProfile(p.id);
                        }
                      }}
                    >
                      {p.avatar_url ? (
                        <img src={p.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-[#00a884] flex items-center justify-center text-white text-xs font-semibold shrink-0">
                          {(p.name || '?')[0]?.toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm text-white truncate">
                          {p.name}
                          {p.id === currentUser.id ? ' (you)' : ''}
                          {showOnlinePresence && onlineUsers.has(p.id) ? (
                            <span className="ml-1 text-[10px] text-emerald-400">• online</span>
                          ) : null}
                        </p>
                        {p.is_group_admin && <p className="text-[10px] text-emerald-400 font-semibold">Group admin</p>}
                      </div>
                    </button>
                    {canManage && p.id !== currentUser.id && (
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          type="button"
                          disabled={roleBusyId === p.id || (p.is_group_admin && adminCount <= 1)}
                          onClick={() => void setMemberAdmin(p.id, !p.is_group_admin)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-[#00a884] hover:bg-[#2a3942] disabled:opacity-40"
                          title={p.is_group_admin ? 'Dismiss as admin' : 'Make group admin'}
                          aria-label={p.is_group_admin ? 'Dismiss as admin' : 'Make group admin'}
                        >
                          {roleBusyId === p.id ? (
                            <span className="text-[10px] px-0.5">…</span>
                          ) : p.is_group_admin ? (
                            <ShieldOff className="w-4 h-4" />
                          ) : (
                            <Shield className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          type="button"
                          disabled={removingId === p.id}
                          onClick={() => void removeMember(p.id)}
                          className="text-xs text-red-400 px-2 py-1 disabled:opacity-40"
                        >
                          {removingId === p.id ? '…' : 'Remove'}
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-2 pt-2 border-t border-[#2a3942]">
            {chat.groupChatType === 'custom_group' && (
              <button
                type="button"
                onClick={() => void leaveGroup()}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-red-400 bg-[#202c33] hover:bg-[#2a3942] text-sm font-semibold"
              >
                <LogOut className="w-4 h-4" /> Leave group
              </button>
            )}
            {canManage && (
              <button
                type="button"
                onClick={() => void deleteGroup()}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-red-400 border border-red-500/30 text-sm font-semibold"
              >
                <Trash2 className="w-4 h-4" /> Delete group
              </button>
            )}
            {chat.groupChatType !== 'custom_group' && (
              <p className="text-[11px] text-gray-500 text-center">
                Organization / committee chats are managed automatically.
              </p>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
