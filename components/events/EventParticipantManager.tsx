'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Plus, Upload, Trash2, Users, ChevronDown, ChevronUp, FolderPlus } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  type EventParticipantGroup,
  NO_GROUP_VALUE,
  groupParticipants,
  parseBulkParticipantLines,
  participantGroupLabel,
  registrationSourceLabel,
} from '@/lib/event-participant-groups';

interface EventParticipantManagerProps {
  eventId: string;
  participants: any[];
  canManage: boolean;
  onRefresh: () => Promise<void> | void;
  selectedParticipantId?: string | null;
  onSelectParticipant?: (participant: any) => void;
  showAttendanceActions?: boolean;
  onMarkAttendance?: (participantId: string, status: 'present' | 'absent') => void;
}

export default function EventParticipantManager({
  eventId,
  participants,
  canManage,
  onRefresh,
  selectedParticipantId,
  onSelectParticipant,
  showAttendanceActions = false,
  onMarkAttendance,
}: EventParticipantManagerProps) {
  const supabase = createClient();
  const [groups, setGroups] = useState<EventParticipantGroup[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [showGroupsPanel, setShowGroupsPanel] = useState(true);
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [showBulkPanel, setShowBulkPanel] = useState(false);
  const [groupFilter, setGroupFilter] = useState<string>('all');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState<string>(NO_GROUP_VALUE);
  const [bulkDefaultGroupId, setBulkDefaultGroupId] = useState<string>(NO_GROUP_VALUE);
  const [markPresent, setMarkPresent] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null);

  const groupNames = useMemo(() => groups.map((g) => g.name), [groups]);

  const loadGroups = useCallback(async () => {
    setGroupsLoading(true);
    const { data, error } = await supabase
      .from('event_participant_groups')
      .select('*')
      .eq('event_id', eventId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) {
      console.error('loadGroups', error);
      if (!error.message?.includes('does not exist')) {
        toast.error('Failed to load participant groups');
      }
      setGroups([]);
    } else {
      setGroups(data || []);
    }
    setGroupsLoading(false);
  }, [eventId, supabase]);

  useEffect(() => {
    void loadGroups();
  }, [loadGroups]);

  function groupNameById(id: string): string {
    if (!id || id === NO_GROUP_VALUE) return '';
    return groups.find((g) => g.id === id)?.name || '';
  }

  const filterOptions = useMemo(() => {
    const fromParticipants = participants
      .map((p) => participantGroupLabel(p.participant_group))
      .filter((g) => g !== 'Unassigned');
    return [...new Set([...groupNames, ...fromParticipants, 'Unassigned'])];
  }, [groupNames, participants]);

  const filteredParticipants = useMemo(() => {
    if (groupFilter === 'all') return participants;
    return participants.filter((p) => participantGroupLabel(p.participant_group) === groupFilter);
  }, [participants, groupFilter]);

  const grouped = useMemo(
    () => groupParticipants(filteredParticipants, groupNames),
    [filteredParticipants, groupNames],
  );

  async function handleCreateGroup() {
    const trimmed = newGroupName.trim();
    if (!trimmed) {
      toast.error('Enter a group name');
      return;
    }
    if (groups.some((g) => g.name.toLowerCase() === trimmed.toLowerCase())) {
      toast.error('This group already exists');
      return;
    }
    setSaving(true);
    const nextOrder = groups.length > 0 ? Math.max(...groups.map((g) => g.sort_order)) + 1 : 0;
    const { error } = await supabase.from('event_participant_groups').insert({
      event_id: eventId,
      name: trimmed,
      sort_order: nextOrder,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message || 'Failed to create group');
      return;
    }
    toast.success(`Group "${trimmed}" created`);
    setNewGroupName('');
    await loadGroups();
  }

  async function handleDeleteGroup(group: EventParticipantGroup) {
    const inGroup = participants.filter(
      (p) => participantGroupLabel(p.participant_group) === group.name,
    ).length;
    if (inGroup > 0) {
      toast.error(`Cannot delete — ${inGroup} participant(s) are in this group`);
      return;
    }
    if (!confirm(`Delete group "${group.name}"?`)) return;
    setDeletingGroupId(group.id);
    const { error } = await supabase.from('event_participant_groups').delete().eq('id', group.id);
    setDeletingGroupId(null);
    if (error) {
      toast.error(error.message || 'Failed to delete group');
      return;
    }
    if (selectedGroupId === group.id) setSelectedGroupId(NO_GROUP_VALUE);
    if (bulkDefaultGroupId === group.id) setBulkDefaultGroupId(NO_GROUP_VALUE);
    toast.success('Group deleted');
    await loadGroups();
  }

  async function handleAddSingle() {
    if (!name.trim()) {
      toast.error('Participant name is required');
      return;
    }
    const groupName = groupNameById(selectedGroupId);
    setSaving(true);
    const { data, error } = await supabase.rpc('add_event_participant_manual', {
      p_event_id: eventId,
      p_participant_name: name.trim(),
      p_participant_email: email.trim() || null,
      p_participant_group: groupName || null,
      p_mark_present: markPresent,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message || 'Failed to add participant');
      return;
    }
    toast.success(`Added ${(data as { participant_name?: string })?.participant_name || name.trim()}`);
    setName('');
    setEmail('');
    setMarkPresent(false);
    setShowAddPanel(false);
    await onRefresh();
  }

  async function handleBulkImport() {
    const defaultGroupName = groupNameById(bulkDefaultGroupId);
    const rows = parseBulkParticipantLines(bulkText, defaultGroupName);
    if (rows.length === 0) {
      toast.error('Add at least one name per line');
      return;
    }
    setSaving(true);
    const { data, error } = await supabase.rpc('bulk_import_event_participants', {
      p_event_id: eventId,
      p_rows: rows,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message || 'Bulk import failed');
      return;
    }
    const result = data as { inserted?: number; skipped?: number };
    toast.success(`Imported ${result.inserted ?? 0} participant(s)${result.skipped ? `, skipped ${result.skipped}` : ''}`);
    setBulkText('');
    setShowBulkPanel(false);
    await onRefresh();
  }

  async function handleDelete(participantId: string) {
    if (!confirm('Remove this participant from the event?')) return;
    setDeletingId(participantId);
    const { error } = await supabase.from('event_participants').delete().eq('id', participantId);
    setDeletingId(null);
    if (error) {
      toast.error(error.message || 'Failed to remove participant');
      return;
    }
    toast.success('Participant removed');
    await onRefresh();
  }

  function renderParticipantRow(p: any) {
    const sourceLabel = registrationSourceLabel(p.registration_source);
    const isSelected = selectedParticipantId === p.id;
    const groupLabel = participantGroupLabel(p.participant_group);

    return (
      <div
        key={p.id}
        className={`rounded-xl border px-4 py-3 transition ${isSelected ? 'border-indigo-300 bg-indigo-50/80' : 'border-gray-200 bg-white/70 hover:bg-gray-50'}`}
      >
        <div className="flex items-start justify-between gap-3">
          <button
            type="button"
            onClick={() => onSelectParticipant?.(p)}
            className="flex-1 text-left min-w-0"
          >
            <p className="font-semibold text-gray-900 truncate">{p.participant_name || 'Participant'}</p>
            <p className="text-xs text-gray-500 truncate">{p.participant_email || 'No email'}</p>
            <div className="flex flex-wrap gap-1 mt-1.5">
              {groupLabel !== 'Unassigned' && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sky-100 text-sky-800">
                  {groupLabel}
                </span>
              )}
              {sourceLabel && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-100 text-violet-800">
                  {sourceLabel}
                </span>
              )}
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${p.attendance_status === 'present' ? 'bg-emerald-100 text-emerald-800' : p.attendance_status === 'absent' ? 'bg-rose-100 text-rose-800' : 'bg-amber-50 text-amber-800'}`}>
                {(p.attendance_status || 'registered').replace('_', ' ')}
              </span>
            </div>
          </button>
          <div className="flex items-center gap-2 shrink-0">
            {showAttendanceActions && onMarkAttendance && (
              <>
                <button type="button" onClick={() => onMarkAttendance(p.id, 'present')} className="text-xs px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700">Present</button>
                <button type="button" onClick={() => onMarkAttendance(p.id, 'absent')} className="text-xs px-3 py-1.5 rounded-lg bg-gray-600 text-white hover:bg-gray-700">Absent</button>
              </>
            )}
            {canManage && (p.registration_source === 'manual' || p.registration_source === 'bulk_import') && (
              <button
                type="button"
                onClick={() => handleDelete(p.id)}
                disabled={deletingId === p.id}
                className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-50"
                title="Remove participant"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const groupSelect = (value: string, onChange: (v: string) => void, label: string) => (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
      >
        <option value={NO_GROUP_VALUE}>No group</option>
        {groups.map((g) => (
          <option key={g.id} value={g.id}>{g.name}</option>
        ))}
      </select>
      {groups.length === 0 && (
        <p className="text-xs text-gray-500 mt-1">Create a group above first, or add without a group.</p>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {canManage && (
        <>
          {/* Step 1: Groups */}
          <div className="rounded-xl border border-sky-100 bg-sky-50/50 p-4 space-y-3">
            <button
              type="button"
              onClick={() => setShowGroupsPanel((v) => !v)}
              className="w-full flex items-center justify-between text-left"
            >
              <div>
                <p className="text-sm font-semibold text-sky-900 flex items-center gap-2">
                  <FolderPlus className="w-4 h-4" />
                  Step 1 — Create participant groups
                </p>
                <p className="text-xs text-sky-800/90 mt-0.5">
                  e.g. 1st Year, 2nd Year, Volunteers — then add people under each group.
                </p>
              </div>
              {showGroupsPanel ? <ChevronUp className="w-5 h-5 text-sky-600" /> : <ChevronDown className="w-5 h-5 text-sky-600" />}
            </button>

            {showGroupsPanel && (
              <div className="space-y-3 pt-1">
                <div className="flex gap-2 flex-wrap">
                  <input
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="Group name (e.g. 1st Year)"
                    className="flex-1 min-w-[180px] border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateGroup()}
                  />
                  <button
                    type="button"
                    onClick={handleCreateGroup}
                    disabled={saving}
                    className="px-4 py-2 rounded-xl bg-sky-600 text-white text-sm font-semibold hover:bg-sky-700 disabled:opacity-50"
                  >
                    Add group
                  </button>
                </div>
                {groupsLoading ? (
                  <p className="text-sm text-gray-500">Loading groups...</p>
                ) : groups.length === 0 ? (
                  <p className="text-sm text-gray-500">No groups yet. You can still add participants without a group.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {groups.map((g) => {
                      const count = participants.filter(
                        (p) => participantGroupLabel(p.participant_group) === g.name,
                      ).length;
                      return (
                        <li key={g.id} className="flex items-center justify-between gap-2 rounded-lg bg-white border border-sky-100 px-3 py-2">
                          <span className="text-sm font-medium text-gray-800">{g.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400">{count} member{count !== 1 ? 's' : ''}</span>
                            <button
                              type="button"
                              onClick={() => handleDeleteGroup(g)}
                              disabled={deletingGroupId === g.id}
                              className="p-1.5 text-gray-400 hover:text-red-600 disabled:opacity-50"
                              title="Delete group"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* Step 2: Add participants */}
          <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4 space-y-3">
            <p className="text-sm font-semibold text-indigo-900">Step 2 — Add participants</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => { setShowAddPanel((v) => !v); setShowBulkPanel(false); }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700"
              >
                <Plus className="w-4 h-4" />
                Add one
                {showAddPanel ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={() => { setShowBulkPanel((v) => !v); setShowAddPanel(false); }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-indigo-200 bg-white text-indigo-700 text-sm font-semibold hover:bg-indigo-50"
              >
                <Upload className="w-4 h-4" />
                Bulk add
                {showBulkPanel ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>

            {showAddPanel && (
              <div className="grid md:grid-cols-2 gap-3 pt-2">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Name *"
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                />
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email (optional)"
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                />
                {groupSelect(selectedGroupId, setSelectedGroupId, 'Add under group')}
                <label className="flex items-center gap-2 text-sm text-gray-700 md:col-span-2">
                  <input type="checkbox" checked={markPresent} onChange={(e) => setMarkPresent(e.target.checked)} className="rounded text-indigo-600" />
                  Mark as present now
                </label>
                <button
                  type="button"
                  onClick={handleAddSingle}
                  disabled={saving}
                  className="md:col-span-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save participant'}
                </button>
              </div>
            )}

            {showBulkPanel && (
              <div className="space-y-3 pt-2">
                {groupSelect(bulkDefaultGroupId, setBulkDefaultGroupId, 'Default group (for lines without a group)')}
                <div className="rounded-lg bg-white border border-indigo-100 px-3 py-2 text-xs text-gray-600">
                  <p className="font-semibold text-gray-800 mb-1">Format (one per line):</p>
                  <code>Name,Email</code> or <code>Name,Email,Group</code>
                  <p className="mt-2 text-gray-500">Examples:</p>
                  <code className="block">Arun Kumar,arun@college.edu</code>
                  <code className="block">Priya S,,1st Year</code>
                  <p className="mt-1 text-gray-500">Group in CSV must match a group you created, or use the default group above.</p>
                </div>
                <textarea
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  rows={8}
                  placeholder="Paste names here..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono bg-white"
                />
                <button
                  type="button"
                  onClick={handleBulkImport}
                  disabled={saving}
                  className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50"
                >
                  {saving ? 'Importing...' : 'Import participants'}
                </button>
              </div>
            )}
          </div>
        </>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Users className="w-4 h-4 text-indigo-500" />
          <span>{filteredParticipants.length} participant{filteredParticipants.length !== 1 ? 's' : ''}</span>
        </div>
        <select
          value={groupFilter}
          onChange={(e) => setGroupFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white"
        >
          <option value="all">All groups</option>
          {filterOptions.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>
      </div>

      {filteredParticipants.length === 0 ? (
        <p className="text-gray-500">No participants yet.</p>
      ) : groupFilter === 'all' ? (
        <div className="space-y-5">
          {grouped.map(({ group, items }) => (
            items.length > 0 && (
              <div key={group}>
                <h4 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-400" />
                  {group}
                  <span className="text-xs font-normal text-gray-400">({items.length})</span>
                </h4>
                <div className="space-y-2">{items.map(renderParticipantRow)}</div>
              </div>
            )
          ))}
        </div>
      ) : (
        <div className="space-y-2">{filteredParticipants.map(renderParticipantRow)}</div>
      )}
    </div>
  );
}
