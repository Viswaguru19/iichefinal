'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, ArrowLeft, Users, MessageSquare, Plus, LayoutDashboard, Trash2, Sun, Moon, Pin, PinOff } from 'lucide-react';
import type { ChatItem, UserProfile } from '@/components/chat/types';
import DynamicLogo from '@/components/DynamicLogo';
import { chatPinKey } from '@/lib/chat-pins';

interface Props {
  chats: ChatItem[];
  allUsers: UserProfile[];
  activeChat: ChatItem | null;
  onlineUsers: Set<string>;
  showOnlinePresence: boolean;
  pinnedKeys?: string[];
  onSelectChat: (chat: ChatItem) => void;
  onNewChat: (user: UserProfile) => void;
  onCreateGroup: (name: string, description: string, memberIds: string[]) => Promise<void>;
  onDeleteChat?: (chat: ChatItem) => void;
  onTogglePin?: (chat: ChatItem) => void;
  onBack: () => void;
  chatOnly?: boolean;
  onOpenPortal?: () => void;
  theme?: 'dark' | 'light';
  onToggleTheme?: () => void;
}

export default function ChatSidebar({
  chats,
  allUsers,
  activeChat,
  onlineUsers,
  showOnlinePresence,
  pinnedKeys = [],
  onSelectChat,
  onNewChat,
  onCreateGroup,
  onDeleteChat,
  onTogglePin,
  onBack,
  chatOnly = false,
  onOpenPortal,
  theme = 'dark',
  onToggleTheme,
}: Props) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'unread' | 'groups'>('all');
  const [showNewChat, setShowNewChat] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupDesc, setGroupDesc] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [creatingGroup, setCreatingGroup] = useState(false);

  const filtered = chats.filter((c) => {
    if (!(c.name ?? '').toLowerCase().includes(search.toLowerCase())) return false;
    if (filter === 'unread') return c.unreadCount > 0;
    if (filter === 'groups') return c.type === 'group';
    return true;
  });

  const filteredUsers = allUsers.filter((u) => (u.name ?? '').toLowerCase().includes(userSearch.toLowerCase()));
  const searchPeople =
    search.trim().length >= 1
      ? allUsers
          .filter((u) => (u.name ?? '').toLowerCase().includes(search.toLowerCase()))
          .filter((u) => !chats.some((c) => c.type === 'direct' && c.id === u.id))
          .slice(0, 8)
      : [];

  return (
    <div className="w-full md:w-[420px] md:min-w-[320px] relative flex flex-col border-r border-[#2a3942] bg-[#111b21] h-full min-h-0 overflow-hidden text-gray-100">
      <div className="px-3 sm:px-4 py-3 bg-[#202c33] flex items-center justify-between gap-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-2.5 min-w-0">
          {!chatOnly && (
            <button type="button" onClick={onBack} className="text-gray-400 hover:text-white transition-colors p-1 shrink-0" aria-label="Back">
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div className="w-9 h-9 rounded-lg bg-white/95 flex items-center justify-center shrink-0 overflow-hidden">
            <DynamicLogo width={30} height={30} />
          </div>
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-semibold text-white truncate leading-tight">IIChE Chat</h1>
            <p className="text-[10px] text-gray-400 truncate">Messages & groups</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {onToggleTheme && (
            <button
              type="button"
              onClick={onToggleTheme}
              className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-[#2a3942]"
              title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          )}
          {chatOnly && onOpenPortal && (
            <button
              type="button"
              onClick={onOpenPortal}
              className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-[#2a3942]"
              title="Open portal"
              aria-label="Open portal"
            >
              <LayoutDashboard className="w-5 h-5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowCreateGroup(true)}
            className="w-9 h-9 rounded-full bg-[#00a884] flex items-center justify-center text-white active:scale-95 touch-manipulation"
            title="Create Group"
          >
            <Users className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setShowNewChat(true)}
            className="w-9 h-9 rounded-full bg-[#00a884] flex items-center justify-center text-white active:scale-95 touch-manipulation"
            title="New chat"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="px-3 py-2 bg-[#111b21]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search or start new chat"
            className="w-full pl-10 pr-4 py-2 bg-[#202c33] rounded-lg text-sm text-white placeholder-gray-500 outline-none focus:ring-1 focus:ring-emerald-500/40"
          />
        </div>
      </div>

      <div className="px-3 py-1.5 flex gap-2 overflow-x-auto mobile-clean-scroll">
        {(['all', 'unread', 'groups'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap shrink-0 touch-manipulation active:scale-95 ${
              filter === f ? 'bg-[#00a884] text-white' : 'bg-[#202c33] text-gray-400 active:bg-[#2a3942]'
            }`}
          >
            {f === 'all' ? 'All' : f === 'unread' ? 'Unread' : 'Groups'}
          </button>
        ))}
      </div>

      {showOnlinePresence && onlineUsers.size > 0 && (
        <div className="px-3 py-2 border-b border-[#2a3942] bg-[#182229]">
          <p className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wide mb-1.5">Online now</p>
          <div className="flex flex-wrap gap-1.5 max-h-16 overflow-y-auto">
            {allUsers
              .filter((u) => onlineUsers.has(u.id))
              .map((u) => (
                <span
                  key={u.id}
                  className="text-[11px] px-2 py-0.5 rounded-full bg-[#202c33] border border-[#2a3942] text-gray-200 truncate max-w-[140px]"
                  title={u.name}
                >
                  {u.name}
                </span>
              ))}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 overscroll-contain">
        {searchPeople.length > 0 && (
          <div className="px-3 py-2 border-b border-[#2a3942]">
            <p className="text-[10px] uppercase tracking-wide text-gray-500 mb-1.5">Start new chat</p>
            {searchPeople.map((user) => (
              <button
                key={`new-${user.id}`}
                type="button"
                onClick={() => {
                  onNewChat(user);
                  setSearch('');
                }}
                className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-[#202c33] text-left"
              >
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-[#00a884] flex items-center justify-center text-white text-xs font-semibold">
                    {(user.name || '?')[0]?.toUpperCase()}
                  </div>
                )}
                <span className="text-sm text-gray-200 truncate">{user.name}</span>
              </button>
            ))}
          </div>
        )}
        {filtered.length === 0 && searchPeople.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No chats found</p>
            <p className="text-xs mt-1 text-gray-600">Use + to message anyone in the portal</p>
          </div>
        ) : (
          filtered.map((chat) => {
            const isActive = activeChat?.id === chat.id && activeChat?.type === chat.type;
            const isOnline = showOnlinePresence && chat.type === 'direct' && onlineUsers.has(chat.id);
            const isPinned = pinnedKeys.includes(chatPinKey(chat.type, chat.id));
            return (
              <div
                key={`${chat.type}-${chat.id}`}
                className={`group flex items-center gap-0.5 px-1 sm:px-2 border-b border-[#1a242b] ${
                  isActive ? 'bg-[#2a3942]' : 'active:bg-[#202c33]'
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelectChat(chat)}
                  className="flex-1 flex items-center gap-3 px-2 py-3 text-left min-w-0 touch-manipulation"
                >
                  <div className="relative flex-shrink-0">
                    {chat.avatar ? (
                      <img src={chat.avatar} alt="" className="w-12 h-12 rounded-full object-cover" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-[#00a884] flex items-center justify-center text-white font-semibold text-sm">
                        {chat.type === 'group' ? <Users className="w-5 h-5" /> : (chat.name || '?')[0]?.toUpperCase()}
                      </div>
                    )}
                    {isOnline && <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-[#111b21]" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-semibold text-gray-100 text-sm truncate flex items-center gap-1 min-w-0">
                        {isPinned && <Pin className="w-3 h-3 text-[#00a884] shrink-0" aria-hidden />}
                        <span className="truncate">{chat.name}</span>
                      </h3>
                      <span className="text-[11px] text-gray-500 flex-shrink-0">
                        {chat.time && new Date(chat.time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5 gap-2">
                      <p className="text-xs text-gray-400 truncate">{chat.lastMessage}</p>
                      {chat.unreadCount > 0 && (
                        <span className="ml-1 min-w-[20px] h-5 bg-[#00a884] rounded-full flex items-center justify-center text-white text-[10px] font-bold px-1.5 shrink-0">
                          {chat.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
                {onTogglePin && (
                  <button
                    type="button"
                    title={isPinned ? 'Unpin chat' : 'Pin chat'}
                    aria-label={isPinned ? 'Unpin chat' : 'Pin chat'}
                    onClick={(e) => {
                      e.stopPropagation();
                      onTogglePin(chat);
                    }}
                    className={`p-2 rounded-lg shrink-0 touch-manipulation active:opacity-70 ${
                      isPinned ? 'text-[#00a884]' : 'text-gray-600'
                    }`}
                  >
                    {isPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
                  </button>
                )}
                {onDeleteChat && (chat.type === 'direct' || chat.groupChatType === 'custom_group') && (
                  <button
                    type="button"
                    title="Delete chat"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteChat(chat);
                    }}
                    className="p-2 text-gray-600 active:text-red-400 shrink-0 touch-manipulation"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      <AnimatePresence>
        {showNewChat && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute inset-0 bg-[#111b21] z-20 flex flex-col"
          >
            <div className="px-4 py-3 bg-[#202c33] flex items-center gap-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
              <button type="button" onClick={() => setShowNewChat(false)} className="text-gray-400 hover:text-white">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h2 className="text-lg font-semibold text-white">New Chat</h2>
            </div>
            <div className="px-3 py-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Search users..."
                  className="w-full pl-10 pr-4 py-2 bg-[#202c33] rounded-lg text-sm text-white placeholder-gray-500 outline-none"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {filteredUsers.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => {
                    onNewChat(user);
                    setShowNewChat(false);
                    setUserSearch('');
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#202c33] text-left border-b border-[#1a242b]"
                >
                  <div className="relative">
                    {user.avatar_url ? (
                      <img src={user.avatar_url} alt="" className="w-11 h-11 rounded-full object-cover" />
                    ) : (
                      <div className="w-11 h-11 rounded-full bg-[#00a884] flex items-center justify-center text-white font-semibold text-sm">
                        {(user.name || '?')[0]?.toUpperCase()}
                      </div>
                    )}
                    {showOnlinePresence && onlineUsers.has(user.id) && (
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[#111b21]" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-gray-100 text-sm">{user.name}</p>
                    <p className="text-xs text-gray-500">{user.role?.replace(/_/g, ' ')}</p>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCreateGroup && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute inset-0 bg-[#111b21] z-30 flex flex-col"
          >
            <div className="px-4 py-3 bg-[#00a884] flex items-center gap-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
              <button
                type="button"
                onClick={() => {
                  setShowCreateGroup(false);
                  setGroupName('');
                  setGroupDesc('');
                  setSelectedMembers([]);
                }}
                className="text-white/80 hover:text-white"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h2 className="text-lg font-semibold text-white">Create Group</h2>
            </div>
            <div className="p-4 space-y-4 border-b border-[#2a3942]">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase">Group Name *</label>
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="Enter group name"
                  className="w-full mt-1 px-3 py-2 bg-[#202c33] rounded-lg text-sm text-white outline-none focus:ring-1 focus:ring-emerald-500/40"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase">Description</label>
                <input
                  type="text"
                  value={groupDesc}
                  onChange={(e) => setGroupDesc(e.target.value)}
                  placeholder="What's this group about?"
                  className="w-full mt-1 px-3 py-2 bg-[#202c33] rounded-lg text-sm text-white outline-none focus:ring-1 focus:ring-emerald-500/40"
                />
              </div>
              <p className="text-xs text-gray-500">
                {selectedMembers.length} member{selectedMembers.length !== 1 ? 's' : ''} selected
              </p>
            </div>
            <div className="px-3 py-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Add members..."
                  className="w-full pl-10 pr-4 py-2 bg-[#202c33] rounded-lg text-sm text-white placeholder-gray-500 outline-none"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {filteredUsers.map((user) => {
                const isSelected = selectedMembers.includes(user.id);
                return (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() =>
                      setSelectedMembers((prev) => (isSelected ? prev.filter((id) => id !== user.id) : [...prev, user.id]))
                    }
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left border-b border-[#1a242b] ${
                      isSelected ? 'bg-[#0b3d34]' : 'hover:bg-[#202c33]'
                    }`}
                  >
                    <div className="relative">
                      {user.avatar_url ? (
                        <img src={user.avatar_url} alt="" className="w-11 h-11 rounded-full object-cover" />
                      ) : (
                        <div className="w-11 h-11 rounded-full bg-[#00a884] flex items-center justify-center text-white font-semibold text-sm">
                          {(user.name || '?')[0]?.toUpperCase()}
                        </div>
                      )}
                      {isSelected && (
                        <div className="absolute bottom-0 right-0 w-5 h-5 bg-[#00a884] rounded-full border-2 border-[#111b21] flex items-center justify-center">
                          <span className="text-white text-[10px]">✓</span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-medium text-gray-100 text-sm">{user.name}</p>
                      <p className="text-xs text-gray-500">{user.role?.replace(/_/g, ' ')}</p>
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="p-4 border-t border-[#2a3942] pb-[max(1rem,env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={async () => {
                  if (!groupName.trim()) return;
                  setCreatingGroup(true);
                  await onCreateGroup(groupName.trim(), groupDesc.trim(), selectedMembers);
                  setCreatingGroup(false);
                  setShowCreateGroup(false);
                  setGroupName('');
                  setGroupDesc('');
                  setSelectedMembers([]);
                }}
                disabled={!groupName.trim() || selectedMembers.length === 0 || creatingGroup}
                className="w-full bg-[#00a884] text-white py-2.5 rounded-xl font-semibold text-sm disabled:opacity-50"
              >
                {creatingGroup ? 'Creating...' : `Create Group (${selectedMembers.length} members)`}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
