'use client';

import { useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Plus, Upload, Trash2, Users, ChevronDown, ChevronUp } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  DEFAULT_PARTICIPANT_GROUPS,
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
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [showBulkPanel, setShowBulkPanel] = useState(false);
  const [groupFilter, setGroupFilter] = useState<string>('all');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [groupChoice, setGroupChoice] = useState<string>(DEFAULT_PARTICIPANT_GROUPS[0]);
  const [customGroup, setCustomGroup] = useState('');
  const [markPresent, setMarkPresent] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const resolvedGroup = groupChoice === 'Other' ? customGroup.trim() : groupChoice;

  const availableGroups = useMemo(() => {
    const fromData = participants
      .map((p) => participantGroupLabel(p.participant_group))
      .filter((g) => g !== 'Unassigned');
    return [...new Set([...DEFAULT_PARTICIPANT_GROUPS, ...fromData, 'Unassigned'])];
  }, [participants]);

  const filteredParticipants = useMemo(() => {
    if (groupFilter === 'all') return participants;
    return participants.filter((p) => participantGroupLabel(p.participant_group) === groupFilter);
  }, [participants, groupFilter]);

  const grouped = useMemo(() => groupParticipants(filteredParticipants), [filteredParticipants]);

  async function handleAddSingle() {
    if (!name.trim()) {
      toast.error('Participant name is required');
      return;
    }
    setSaving(true);
    const { data, error } = await supabase.rpc('add_event_participant_manual', {
      p_event_id: eventId,
      p_participant_name: name.trim(),
      p_participant_email: email.trim() || null,
      p_participant_group: resolvedGroup || null,
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
    setCustomGroup('');
    setMarkPresent(false);
    setShowAddPanel(false);
    await onRefresh();
  }

  async function handleBulkImport() {
    const rows = parseBulkParticipantLines(bulkText);
    if (rows.length === 0) {
      toast.error('Add at least one line: Name,Email,Group');
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
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sky-100 text-sky-800">
                {participantGroupLabel(p.participant_group)}
              </span>
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

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4 space-y-3">
          <p className="text-sm font-semibold text-indigo-900">Add participants manually</p>
          <p className="text-xs text-indigo-800/90">
            Use this when someone did not register via the form. You can still mark their attendance from the list below or the Attendance tab.
          </p>
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
              <select
                value={groupChoice}
                onChange={(e) => setGroupChoice(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
              >
                {DEFAULT_PARTICIPANT_GROUPS.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
              {groupChoice === 'Other' && (
                <input
                  value={customGroup}
                  onChange={(e) => setCustomGroup(e.target.value)}
                  placeholder="Custom group name"
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                />
              )}
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
              <div className="rounded-lg bg-white border border-indigo-100 px-3 py-2 text-xs text-gray-600">
                <p className="font-semibold text-gray-800 mb-1">Format (one per line):</p>
                <code>Name,Email,Group</code>
                <p className="mt-2 text-gray-500">Example:</p>
                <code className="block">Arun Kumar,arun@college.edu,1st Year</code>
                <code className="block">Priya S,,2nd Year</code>
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
          {availableGroups.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>
      </div>

      {filteredParticipants.length === 0 ? (
        <p className="text-gray-500">No participants in this group yet.</p>
      ) : groupFilter === 'all' ? (
        <div className="space-y-5">
          {grouped.map(({ group, items }) => (
            <div key={group}>
              <h4 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-400" />
                {group}
                <span className="text-xs font-normal text-gray-400">({items.length})</span>
              </h4>
              <div className="space-y-2">{items.map(renderParticipantRow)}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">{filteredParticipants.map(renderParticipantRow)}</div>
      )}
    </div>
  );
}
