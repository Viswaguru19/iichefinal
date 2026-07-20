import type { PortalNotificationInsert } from '@/lib/portal-notifications-client';
import { insertPortalNotifications } from '@/lib/portal-notifications-client';

const EC_COMMITTEE_ID = '00000000-0000-0000-0000-000000000001';

type NotifyPayload = Omit<PortalNotificationInsert, 'user_id'>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function notifyUsers(supabase: any, userIds: string[], payload: NotifyPayload) {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!ids.length) return;
  await insertPortalNotifications(
    supabase,
    ids.map((user_id) => ({ ...payload, user_id })),
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function notifyCommittee(supabase: any, committeeId: string, payload: NotifyPayload) {
  const { data: members } = await supabase
    .from('committee_members')
    .select('user_id')
    .eq('committee_id', committeeId);
  if (!members?.length) return;
  await notifyUsers(
    supabase,
    members.map((m: { user_id: string }) => m.user_id),
    payload,
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function notifyEC(supabase: any, payload: NotifyPayload) {
  await notifyCommittee(supabase, EC_COMMITTEE_ID, payload);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function notifyFaculty(supabase: any, payload: NotifyPayload) {
  const { data: faculty } = await supabase.from('profiles').select('id').eq('is_faculty', true);
  if (!faculty?.length) return;
  await notifyUsers(
    supabase,
    faculty.map((f: { id: string }) => f.id),
    payload,
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function notifyCommitteeHeads(supabase: any, committeeId: string, payload: NotifyPayload) {
  const { data: members } = await supabase
    .from('committee_members')
    .select('user_id, position')
    .eq('committee_id', committeeId)
    .in('position', ['head', 'co-head', 'co_head', 'cohead']);
  if (!members?.length) return;
  await notifyUsers(
    supabase,
    members.map((m: { user_id: string }) => m.user_id),
    payload,
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function notifyEventProposer(supabase: any, eventId: string, payload: NotifyPayload) {
  const { data: event } = await supabase.from('events').select('proposed_by, created_by').eq('id', eventId).maybeSingle();
  const uid = event?.proposed_by || event?.created_by;
  if (!uid) return;
  await notifyUsers(supabase, [uid], payload);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function notifyAllPortalUsers(supabase: any, payload: NotifyPayload, limit = 200) {
  const { data: profiles } = await supabase.from('profiles').select('id').limit(limit);
  if (!profiles?.length) return;
  await notifyUsers(
    supabase,
    profiles.map((p: { id: string }) => p.id),
    payload,
  );
}
