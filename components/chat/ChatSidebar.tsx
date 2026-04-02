'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, ArrowLeft, Users, MessageSquare, Plus, X } from 'lucide-react';
import type { ChatItem, UserProfile } from '@/app/dashboard/chat/page';

interface Props {
    chats: ChatItem[];
    allUsers: UserProfile[];
    activeChat: ChatItem | null;
    onlineUsers: Set<string>;
    /** When false, online dots and the "Online now" list are hidden (portal admins only). */
    showOnlinePresence: boolean;
    onSelectChat: (chat: ChatItem) => void;
    onNewChat: (user: UserProfile) => void;
    onCreateGroup: (name: string, description: string, memberIds: string[]) => Promise<void>;
    onBack: () => void;
}

export default function ChatSidebar({ chats, allUsers, activeChat, onlineUsers, showOnlinePresence, onSelectChat, onNewChat, onCreateGroup, onBack }: Props) {
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState<'all' | 'unread' | 'groups'>('all');
    const [showNewChat, setShowNewChat] = useState(false);
    const [userSearch, setUserSearch] = useState('');
    const [showCreateGroup, setShowCreateGroup] = useState(false);
    const [groupName, setGroupName] = useState('');
    const [groupDesc, setGroupDesc] = useState('');
    const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
    const [creatingGroup, setCreatingGroup] = useState(false);
    const filtered = chats.filter(c => {
        if (!(c.name ?? '').toLowerCase().includes(search.toLowerCase())) return false;
        if (filter === 'unread') return c.unreadCount > 0;
        if (filter === 'groups') return c.type === 'group';
        return true;
    });

    const filteredUsers = allUsers.filter(u => (u.name ?? '').toLowerCase().includes(userSearch.toLowerCase()));

    return (
        <div className="w-full sm:w-[420px] sm:min-w-[320px] flex flex-col border-r border-gray-200 bg-white h-full">
            {/* Header */}
            <div className="px-4 py-3 bg-[#f0f2f5] flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="text-gray-500 hover:text-gray-700 transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <h1 className="text-xl font-bold text-gray-800">Chats</h1>
                </div>
                <div className="flex items-center gap-2">
                    <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => setShowCreateGroup(true)}
                        className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center text-white shadow-md" title="Create Group">
                        <Users className="w-4 h-4" />
                    </motion.button>
                    <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => setShowNewChat(true)}
                        className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white shadow-md">
                        <Plus className="w-5 h-5" />
                    </motion.button>
                </div>
            </div>

            {/* Search */}
            <div className="px-3 py-2 bg-white">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search or start new chat"
                        className="w-full pl-10 pr-4 py-2 bg-[#f0f2f5] rounded-lg text-sm outline-none focus:ring-1 focus:ring-indigo-300 transition-all" />
                </div>
            </div>

            {/* Filter Tabs */}
            <div className="px-3 py-1.5 flex gap-2">
                {(['all', 'unread', 'groups'] as const).map(f => (
                    <button key={f} onClick={() => setFilter(f)}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${filter === f ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                        {f === 'all' ? 'All' : f === 'unread' ? 'Unread' : 'Groups'}
                    </button>
                ))}
            </div>

            {showOnlinePresence && onlineUsers.size > 0 && (
                <div className="px-3 py-2 border-b border-gray-100 bg-emerald-50/40">
                    <p className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wide mb-1.5">Online now</p>
                    <div className="flex flex-wrap gap-1.5 max-h-16 overflow-y-auto">
                        {allUsers.filter((u) => onlineUsers.has(u.id)).map((u) => (
                            <span key={u.id} className="text-[11px] px-2 py-0.5 rounded-full bg-white border border-emerald-200 text-emerald-900 truncate max-w-[140px]" title={u.name}>
                                {u.name}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Chat List */}
            <div className="flex-1 overflow-y-auto">
                {filtered.length === 0 ? (
                    <div className="p-8 text-center text-gray-400">
                        <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-40" />
                        <p className="text-sm">No chats found</p>
                    </div>
                ) : (
                    filtered.map(chat => {
                        const isActive = activeChat?.id === chat.id && activeChat?.type === chat.type;
                        const isOnline = showOnlinePresence && chat.type === 'direct' && onlineUsers.has(chat.id);
                        return (
                            <motion.div key={`${chat.type}-${chat.id}`} whileHover={{ backgroundColor: 'rgba(0,0,0,0.04)' }}
                                onClick={() => onSelectChat(chat)}
                                className={`flex items-center gap-3 px-4 py-3 cursor-pointer border-b border-gray-50 transition-colors ${isActive ? 'bg-[#f0f2f5]' : ''}`}>
                                <div className="relative flex-shrink-0">
                                    {chat.avatar ? (
                                        <img src={chat.avatar} alt="" className="w-12 h-12 rounded-full object-cover" />
                                    ) : (
                                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-semibold text-sm">
                                            {chat.type === 'group' ? <Users className="w-5 h-5" /> : (chat.name || '?')[0]?.toUpperCase()}
                                        </div>
                                    )}
                                    {isOnline && <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-white" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between">
                                        <h3 className="font-semibold text-gray-900 text-sm truncate">{chat.name}</h3>
                                        <span className="text-[11px] text-gray-400 flex-shrink-0 ml-2">
                                            {chat.time && new Date(chat.time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between mt-0.5">
                                        <p className="text-xs text-gray-500 truncate">{chat.lastMessage}</p>
                                        {chat.unreadCount > 0 && (
                                            <span className="ml-2 min-w-[20px] h-5 bg-emerald-500 rounded-full flex items-center justify-center text-white text-[10px] font-bold px-1.5">
                                                {chat.unreadCount}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })
                )}
            </div>

            {/* New Chat Panel */}
            <AnimatePresence>
                {showNewChat && (
                    <motion.div initial={{ x: -420 }} animate={{ x: 0 }} exit={{ x: -420 }} transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        className="absolute inset-0 bg-white z-20 flex flex-col">
                        <div className="px-4 py-3 bg-[#f0f2f5] flex items-center gap-3">
                            <button onClick={() => setShowNewChat(false)} className="text-gray-500 hover:text-gray-700"><ArrowLeft className="w-5 h-5" /></button>
                            <h2 className="text-lg font-bold text-gray-800">New Chat</h2>
                        </div>
                        <div className="px-3 py-2">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input type="text" value={userSearch} onChange={e => setUserSearch(e.target.value)} placeholder="Search users..."
                                    className="w-full pl-10 pr-4 py-2 bg-[#f0f2f5] rounded-lg text-sm outline-none" />
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            {filteredUsers.map(user => (
                                <div key={user.id} onClick={() => { onNewChat(user); setShowNewChat(false); setUserSearch(''); }}
                                    className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-50">
                                    <div className="relative">
                                        {user.avatar_url ? (
                                            <img src={user.avatar_url} alt="" className="w-11 h-11 rounded-full object-cover" />
                                        ) : (
                                            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-semibold text-sm">
                                                {(user.name || '?')[0]?.toUpperCase()}
                                            </div>
                                        )}
                                        {showOnlinePresence && onlineUsers.has(user.id) && <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white" />}
                                    </div>
                                    <div>
                                        <p className="font-medium text-gray-900 text-sm">{user.name}</p>
                                        <p className="text-xs text-gray-400">{user.role?.replace(/_/g, ' ')}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Create Group Panel */}
            <AnimatePresence>
                {showCreateGroup && (
                    <motion.div initial={{ x: -420 }} animate={{ x: 0 }} exit={{ x: -420 }} transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        className="absolute inset-0 bg-white z-30 flex flex-col">
                        <div className="px-4 py-3 bg-gradient-to-r from-emerald-500 to-green-600 flex items-center gap-3">
                            <button onClick={() => { setShowCreateGroup(false); setGroupName(''); setGroupDesc(''); setSelectedMembers([]); }} className="text-white/80 hover:text-white"><ArrowLeft className="w-5 h-5" /></button>
                            <h2 className="text-lg font-bold text-white">Create Group</h2>
                        </div>
                        <div className="p-4 space-y-4 border-b border-gray-100">
                            <div>
                                <label className="text-xs font-semibold text-gray-500 uppercase">Group Name *</label>
                                <input type="text" value={groupName} onChange={e => setGroupName(e.target.value)} placeholder="Enter group name"
                                    className="w-full mt-1 px-3 py-2 bg-[#f0f2f5] rounded-lg text-sm outline-none focus:ring-1 focus:ring-emerald-300" />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-gray-500 uppercase">Description</label>
                                <input type="text" value={groupDesc} onChange={e => setGroupDesc(e.target.value)} placeholder="What's this group about?"
                                    className="w-full mt-1 px-3 py-2 bg-[#f0f2f5] rounded-lg text-sm outline-none focus:ring-1 focus:ring-emerald-300" />
                            </div>
                            <p className="text-xs text-gray-500">{selectedMembers.length} member{selectedMembers.length !== 1 ? 's' : ''} selected</p>
                        </div>
                        <div className="px-3 py-2">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input type="text" value={userSearch} onChange={e => setUserSearch(e.target.value)} placeholder="Add members..."
                                    className="w-full pl-10 pr-4 py-2 bg-[#f0f2f5] rounded-lg text-sm outline-none" />
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            {filteredUsers.map(user => {
                                const isSelected = selectedMembers.includes(user.id);
                                return (
                                    <div key={user.id} onClick={() => setSelectedMembers(prev => isSelected ? prev.filter(id => id !== user.id) : [...prev, user.id])}
                                        className={`flex items-center gap-3 px-4 py-3 cursor-pointer border-b border-gray-50 ${isSelected ? 'bg-emerald-50' : 'hover:bg-gray-50'}`}>
                                        <div className="relative">
                                            {user.avatar_url ? (
                                                <img src={user.avatar_url} alt="" className="w-11 h-11 rounded-full object-cover" />
                                            ) : (
                                                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-semibold text-sm">
                                                    {(user.name || '?')[0]?.toUpperCase()}
                                                </div>
                                            )}
                                            {isSelected && <div className="absolute bottom-0 right-0 w-5 h-5 bg-emerald-500 rounded-full border-2 border-white flex items-center justify-center"><span className="text-white text-[10px]">✓</span></div>}
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-medium text-gray-900 text-sm">{user.name}</p>
                                            <p className="text-xs text-gray-400">{user.role?.replace(/_/g, ' ')}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="p-4 border-t border-gray-100">
                            <button onClick={async () => {
                                if (!groupName.trim()) { return; }
                                setCreatingGroup(true);
                                await onCreateGroup(groupName.trim(), groupDesc.trim(), selectedMembers);
                                setCreatingGroup(false);
                                setShowCreateGroup(false);
                                setGroupName('');
                                setGroupDesc('');
                                setSelectedMembers([]);
                            }} disabled={!groupName.trim() || selectedMembers.length === 0 || creatingGroup}
                                className="w-full bg-gradient-to-r from-emerald-500 to-green-600 text-white py-2.5 rounded-xl font-semibold text-sm disabled:opacity-50">
                                {creatingGroup ? 'Creating...' : `Create Group (${selectedMembers.length} members)`}
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
