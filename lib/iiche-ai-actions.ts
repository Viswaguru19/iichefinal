import { nanoid } from 'nanoid';
import { defaultOptionsForFieldType, defaultValidationForFieldType } from '@/lib/form-field-types';
import { isCoHeadPosition, isHeadPosition } from '@/lib/committee-positions';
import { notifyEC, notifyCommitteeHeads, notifyFaculty } from '@/lib/portal-notify-helpers';
import { isPortalAdmin } from '@/lib/permissions';
import {
  executiveRoleCountsForProposalEc,
  normalizeProposalThresholds,
  proposalEcSatisfied,
} from '@/lib/proposal-workflow-rules';
import { composeIichePoster, resolvePosterTheme } from '@/lib/iiche-ai-poster';
import { formatPortalDate, formatPortalDateTime } from '@/lib/portal-date';

export type IicheAiToolCtx = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  directory: any;
  userId: string;
  userEmail?: string;
  userName?: string;
  origin: string;
  cookie?: string;
  posterDraft?: { path?: string; eventId: string; title?: string; dataUrl?: string } | null;
};

export const IICHE_AI_TOOL_DECLARATIONS = [
  {
    name: 'get_committee_officers',
    description: 'List the head and co-heads of a committee by name (e.g. Program, Editorial, Graphics). Use this whenever someone asks who leads a committee.',
    parameters: {
      type: 'object',
      properties: {
        committee_name: { type: 'string', description: 'Committee name or partial name. Empty string lists every committee.' },
      },
    },
  },
  {
    name: 'get_my_identity',
    description:
      'Look up the signed-in member: name, email, portal role, executive role, faculty/admin flags, and committee posts. Use for “who am I”, “what is my name”, “my role”, or “which committee am I in”. Do not only open the profile page.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'open_portal_page',
    description:
      'Open a real portal page in this browser. Use for elections, voting, forms, meetings, tasks, and any “take me to / open / where is” request. Never say you cannot navigate.',
    parameters: {
      type: 'object',
      properties: {
        page: {
          type: 'string',
          description:
            'Page key: election, dashboard, forms, meetings, tasks, documents, accounts, minutes, kickoff, profile, proposals, propose-event, reports, chat, hiring, posters',
        },
      },
      required: ['page'],
    },
  },
  {
    name: 'manage_election',
    description:
      'Start contesting, finalize contestants, open voting, stop, or hide the EC election if the signed-in user is an election manager. Use when they say start election, finalize contestants, open election, or stop election. Do not say you cannot; call this and report the result.',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', description: 'start, finalize, open, stop, hide, results, or new' },
      },
      required: ['action'],
    },
  },
  {
    name: 'propose_event',
    description: 'Submit a real event proposal in the portal.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        event_date: { type: 'string', description: 'ISO date. Default tomorrow.' },
        location: { type: 'string' },
        budget: { type: 'number' },
      },
      required: ['title'],
    },
  },
  {
    name: 'approve_proposal',
    description: 'Approve a pending event proposal at the step the user is allowed to (head, EC, or faculty).',
    parameters: {
      type: 'object',
      properties: {
        event_title: { type: 'string' },
      },
    },
  },
  {
    name: 'design_poster',
    description: 'Create one finished event poster and attach it to the event. Do this whenever they ask to make/design/create a poster. Pick the named event, or the latest event if none is named.',
    parameters: {
      type: 'object',
      properties: {
        event_title: { type: 'string' },
        tagline: { type: 'string' },
      },
      required: ['event_title'],
    },
  },
  {
    name: 'upload_poster',
    description: 'Attach the last poster shown in chat to the event. Only use when the user explicitly says to upload, save, attach, or publish the poster.',
    parameters: {
      type: 'object',
      properties: {
        event_title: { type: 'string' },
      },
    },
  },
  {
    name: 'create_form',
    description: 'Create a real form in the portal. Use when the user asks to create, make, or add a form.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        fields: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              label: { type: 'string' },
              type: { type: 'string', description: 'text, textarea, email, radio, checkbox, dropdown, number, date, mobile' },
              required: { type: 'boolean' },
              options: { type: 'array', items: { type: 'string' } },
            },
          },
        },
      },
      required: ['title'],
    },
  },
  {
    name: 'create_meeting',
    description: 'Schedule a real meeting in the portal. Use when the user asks to create or schedule a meeting.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        meeting_type: { type: 'string', description: 'online or offline' },
        meeting_date: { type: 'string', description: 'ISO datetime. Default tomorrow 5pm IST if omitted.' },
        duration: { type: 'number', description: 'Minutes. Default 60.' },
        location: { type: 'string' },
        agenda: { type: 'string' },
        audience_type: {
          type: 'string',
          description: 'all_members, executive_committee, heads_only, coheads_only, specific_committee, general',
        },
        committee_name: { type: 'string' },
      },
      required: ['title'],
    },
  },
  {
    name: 'create_event_report',
    description: 'Create an event report for an existing event by title.',
    parameters: {
      type: 'object',
      properties: {
        event_title: { type: 'string' },
        additional_notes: { type: 'string' },
      },
      required: ['event_title'],
    },
  },
  {
    name: 'create_minutes',
    description: 'Save minutes of meeting (MoM). Links to an existing meeting when the title matches; otherwise stores a standalone minutes record.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        minutes: { type: 'string', description: 'The minutes / MoM text' },
        meeting_title: { type: 'string', description: 'Existing meeting to attach to, if known' },
        meeting_date: { type: 'string', description: 'ISO date if creating standalone minutes' },
      },
      required: ['minutes'],
    },
  },
  {
    name: 'list_events',
    description:
      'List real chapter events (title, date, venue, status). Use when they ask what events exist, upcoming events, or details of a named event. Do not invent events.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Optional title fragment to search. Empty lists the latest events.' },
      },
    },
  },
];

function str(v: unknown): string {
  return String(v ?? '').trim();
}

function allowedFieldType(type: string): string {
  const t = type.trim().toLowerCase();
  const map: Record<string, string> = {
    short: 'text',
    'short answer': 'text',
    paragraph: 'textarea',
    long: 'textarea',
    multiple: 'radio',
    'multiple choice': 'radio',
    choice: 'radio',
    select: 'dropdown',
    phone: 'mobile',
  };
  const resolved = map[t] || t;
  const ok = ['text', 'textarea', 'radio', 'checkbox', 'dropdown', 'date', 'number', 'email', 'mobile', 'file', 'roll_no'];
  return ok.includes(resolved) ? resolved : 'text';
}

async function findCommittee(directory: IicheAiToolCtx['directory'], name: string) {
  const q = name.trim();
  const { data } = await directory.from('committees').select('id, name').order('name');
  const rows = (data || []) as { id: string; name: string }[];
  if (!q) return rows;
  const lower = q.toLowerCase();
  const exact = rows.filter((c) => c.name.toLowerCase() === lower);
  if (exact.length) return exact;
  return rows.filter((c) => c.name.toLowerCase().includes(lower) || lower.includes(c.name.toLowerCase()));
}

function isThisCommitteeQuery(name: string): boolean {
  const q = name.trim().toLowerCase().replace(/[?.!]+$/g, '');
  return !q || /^(this|my|our)(\s+committe?e?s?)?$/.test(q);
}

export async function getCommitteeOfficers(ctx: IicheAiToolCtx, committeeName: string): Promise<string> {
  let committees: { id: string; name: string }[] = [];
  if (isThisCommitteeQuery(committeeName)) {
    const { data: mine } = await ctx.supabase
      .from('committee_members')
      .select('committee_id, committees(id, name)')
      .eq('user_id', ctx.userId);
    committees = (mine || [])
      .map((row: { committee_id?: string; committees?: { id?: string; name?: string } | { id?: string; name?: string }[] }) => {
        const c = Array.isArray(row.committees) ? row.committees[0] : row.committees;
        return { id: String(c?.id || row.committee_id || ''), name: String(c?.name || '') };
      })
      .filter((c: { id: string; name: string }) => c.id && c.name);
    if (!committees.length) return 'You are not listed on a committee, so I cannot infer “this committee”. Name the committee, for example Program Committee.';
  } else {
    committees = await findCommittee(ctx.directory, committeeName);
  }
  if (!committees.length) {
    const { data } = await ctx.directory.from('committees').select('name').order('name');
    const names = ((data || []) as { name: string }[]).map((c) => c.name).join(', ');
    return `No committee matched "${committeeName || '(blank)'}". Available: ${names || 'none'}.`;
  }

  const lines: string[] = [];
  for (const c of committees) {
    const { data: members } = await ctx.directory
      .from('committee_members')
      .select('position, profiles(name)')
      .eq('committee_id', c.id);
    const heads: string[] = [];
    const coheads: string[] = [];
    for (const m of members || []) {
      const person = (m as { profiles?: { name?: string } | { name?: string }[] }).profiles;
      const name = Array.isArray(person) ? person[0]?.name : person?.name;
      const label = String(name || 'Member').trim();
      if (isHeadPosition((m as { position?: string }).position)) heads.push(label);
      else if (isCoHeadPosition((m as { position?: string }).position)) coheads.push(label);
    }
    lines.push(
      `**${c.name}**\n- Head: ${heads.length ? heads.join(', ') : '—'}\n- Co-head(s): ${coheads.length ? coheads.join(', ') : '—'}`,
    );
  }
  return lines.join('\n\n');
}

function titleCaseRole(value: string | null | undefined): string {
  const v = String(value || '').trim();
  if (!v) return '—';
  return v.replace(/[_-]+/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function membershipLabel(position: string | null | undefined, fallbackRole?: string | null): string {
  if (isHeadPosition(position)) return 'Head';
  if (isCoHeadPosition(position)) return 'Co-head';
  const n = String(position || fallbackRole || 'member').trim();
  if (!n || n.toLowerCase() === 'member') return 'Member';
  return titleCaseRole(n);
}

export async function listEvents(ctx: IicheAiToolCtx, query: string): Promise<string> {
  const q = query.trim();
  let req = ctx.directory
    .from('events')
    .select('id, title, event_date, location, status, committees(name)')
    .order('created_at', { ascending: false })
    .limit(10);
  if (q) req = req.ilike('title', `%${q}%`);
  const { data, error } = await req;
  if (error) return `Could not load events: ${error.message}`;
  const rows = (data || []) as {
    title?: string;
    event_date?: string;
    location?: string;
    status?: string;
    committees?: { name?: string } | { name?: string }[];
  }[];
  if (!rows.length) {
    return q
      ? `No event matched "${q}". Open /dashboard/propose-event to submit one, or /dashboard/proposals to see pending items.`
      : 'There are no events on record yet. Propose one at /dashboard/propose-event.';
  }

  const lines = [
    q ? `Events matching **${q}**:` : 'Latest chapter events:',
    '',
    '| Event | Date | Venue | Status | Committee |',
    '| --- | --- | --- | --- | --- |',
  ];
  for (const ev of rows) {
    const committee = Array.isArray(ev.committees) ? ev.committees[0]?.name : ev.committees?.name;
    const when = ev.event_date;
    const dateLabel = when
      ? formatPortalDate(when)
      : 'TBA';
    lines.push(
      `| ${ev.title || 'Untitled'} | ${dateLabel} | ${ev.location || 'TBA'} | ${(ev.status || '—').replace(/_/g, ' ')} | ${committee || '—'} |`,
    );
  }
  lines.push('', 'Open /dashboard/proposals for approvals or /dashboard to see the calendar.');
  return lines.join('\n');
}

export async function getMyIdentity(ctx: IicheAiToolCtx): Promise<string> {
  const db = ctx.directory || ctx.supabase;
  const { data: profile, error } = await db
    .from('profiles')
    .select('name, email, username, role, executive_role, is_admin, is_faculty, approved')
    .eq('id', ctx.userId)
    .maybeSingle();
  if (error) {
    return `Could not load your profile: ${error.message}`;
  }

  const displayName =
    String(profile?.name || ctx.userName || '').trim() ||
    String(profile?.username || '').trim() ||
    String(ctx.userEmail || profile?.email || '').split('@')[0] ||
    '';

  if (!profile && !displayName) {
    return 'You are signed in, but there is no profile row for this account yet. Open /dashboard/profile after an admin approves you.';
  }

  const { data: memberships } = await db
    .from('committee_members')
    .select('position, designation, committees(name)')
    .eq('user_id', ctx.userId);

  const flags = [
    profile?.approved === false ? 'pending approval' : 'approved',
    profile?.is_faculty ? 'faculty' : null,
    profile?.is_admin ? 'admin' : null,
  ].filter(Boolean);

  const rows = [
    `| Name | ${displayName || '—'} |`,
    `| Email | ${profile?.email || ctx.userEmail || '—'} |`,
    profile?.username ? `| Username | ${profile.username} |` : null,
    `| Portal role | ${titleCaseRole(profile?.role)} |`,
    `| Executive role | ${titleCaseRole(profile?.executive_role)} |`,
    `| Account | ${flags.join(', ') || '—'} |`,
  ].filter(Boolean);

  const memberLines = (memberships || []).map(
    (row: { position?: string; designation?: string; committees?: { name?: string } | { name?: string }[] }) => {
      const c = Array.isArray(row.committees) ? row.committees[0] : row.committees;
      const committee = String(c?.name || 'Committee').trim();
      return `- **${committee}** — ${membershipLabel(row.position || row.designation)}`;
    },
  );

  return [
    `You are signed in as **${displayName || 'a chapter member'}**.`,
    '',
    '| Field | Detail |',
    '| --- | --- |',
    ...rows,
    '',
    '## Committees',
    memberLines.length ? memberLines.join('\n') : '- You are not listed on a committee yet.',
    '',
    'Edit photo and bio at /dashboard/profile if you need to change something.',
  ].join('\n');
}

export async function createForm(ctx: IicheAiToolCtx, args: Record<string, unknown>): Promise<string> {
  const title = str(args.title);
  if (!title) return 'A form title is required.';
  const rawFields = Array.isArray(args.fields) ? args.fields : [];
  const fields = (rawFields.length
    ? rawFields
    : [
        { label: 'Name', type: 'text', required: true },
        { label: 'Email', type: 'email', required: true },
        { label: 'Your response', type: 'textarea', required: true },
      ]
  ).map((f, i) => {
    const row = f as { label?: string; type?: string; required?: boolean; options?: string[] };
    const type = allowedFieldType(String(row.type || 'text'));
    const options = Array.isArray(row.options) && row.options.length
      ? row.options.map((o) => String(o))
      : defaultOptionsForFieldType(type);
    return {
      id: `f_${nanoid(7)}`,
      field_type: type,
      label: str(row.label) || `Question ${i + 1}`,
      description: '',
      options,
      required: row.required !== false,
      validation: defaultValidationForFieldType(type),
      order_index: i,
    };
  });

  const { data, error } = await ctx.supabase
    .from('forms')
    .insert({
      title,
      description: str(args.description) || null,
      fields,
      created_by: ctx.userId,
      is_active: true,
      settings: {
        allow_multiple: false,
        require_login: false,
        access_type: 'public',
        status: 'active',
        response_viewer_ids: [],
        response_viewers_all: false,
        show_attendance_qr_after_submit: false,
      },
      form_type: 'normal',
      event_id: null,
    })
    .select('id, title')
    .single();

  if (error || !data) return `Could not create the form: ${error?.message || 'unknown error'}`;
  try {
    await notifyEC(ctx.supabase, {
      type: 'form',
      title: 'New form',
      message: `${title} was created with IIChE AI`,
      link: `/dashboard/forms/${data.id}`,
    });
  } catch {
    /* ignore notify failures */
  }
  return `Created form "${data.title}". Open it at ${ctx.origin}/dashboard/forms/${data.id} (edit: ${ctx.origin}/dashboard/forms/${data.id}/edit).`;
}

function defaultMeetingDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(17, 0, 0, 0);
  return d.toISOString();
}

export async function createMeeting(ctx: IicheAiToolCtx, args: Record<string, unknown>): Promise<string> {
  const title = str(args.title);
  if (!title) return 'A meeting title is required.';
  let meetingDate = str(args.meeting_date);
  if (!meetingDate) meetingDate = defaultMeetingDate();
  const when = new Date(meetingDate);
  if (Number.isNaN(when.getTime())) return 'I could not read that meeting date. Use a real date and time.';
  if (when.getTime() < Date.now() - 10_000) {
    when.setDate(when.getDate() + 1);
  }
  const audience = str(args.audience_type) || 'all_members';
  let committeeId: string | undefined;
  if (audience === 'specific_committee' && str(args.committee_name)) {
    const found = await findCommittee(ctx.directory, str(args.committee_name));
    if (!found.length) return `No committee matched "${args.committee_name}".`;
    committeeId = found[0].id;
  }

  const body: Record<string, unknown> = {
    title,
    description: str(args.description) || undefined,
    meeting_type: str(args.meeting_type) === 'offline' ? 'offline' : 'online',
    meeting_date: when.toISOString(),
    duration: Number(args.duration) > 0 ? Number(args.duration) : 60,
    agenda: str(args.agenda) || undefined,
    audience_type: audience,
    access_type: audience === 'general' ? 'general' : 'invite_only',
    require_approval: false,
    invite_faculty: false,
  };
  if (body.meeting_type === 'offline') body.location = str(args.location) || 'TBA';
  if (committeeId) body.committee_id = committeeId;
  if (body.meeting_type === 'online') body.room_id = nanoid();

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (ctx.cookie) headers.cookie = ctx.cookie;
  const res = await fetch(`${ctx.origin}/api/meetings/create`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string; meeting?: { id: string }; meeting_link?: string };
  if (!res.ok) return `Could not create the meeting: ${data.error || res.statusText}`;
  const link = data.meeting_link || `${ctx.origin}/dashboard/meetings`;
  return `Scheduled meeting "${title}" for ${formatPortalDateTime(when)}. Open ${ctx.origin}/dashboard/meetings — join link: ${link}`;
}

export async function createEventReport(ctx: IicheAiToolCtx, args: Record<string, unknown>): Promise<string> {
  const q = str(args.event_title);
  if (!q) return 'Tell me which event to report on.';
  const { data: events, error } = await ctx.supabase
    .from('events')
    .select('id, title, description, location, event_date, status, committees(name)')
    .ilike('title', `%${q}%`)
    .order('created_at', { ascending: false })
    .limit(5);
  if (error) return `Could not find events: ${error.message}`;
  const event = (events || [])[0] as {
    id: string;
    title: string;
    description?: string;
    location?: string;
    event_date?: string;
    status?: string;
    committees?: { name?: string };
  } | undefined;
  if (!event) return `No event matched "${q}".`;

  const content = [
    `# Event report: ${event.title}`,
    '',
    `- Committee: ${event.committees?.name || 'N/A'}`,
    `- Date: ${event.event_date ? formatPortalDate(event.event_date) : 'TBA'}`,
    `- Venue: ${event.location || 'N/A'}`,
    `- Status: ${event.status || 'N/A'}`,
    '',
    event.description || '',
    '',
    str(args.additional_notes) ? `## Notes\n${str(args.additional_notes)}` : '',
    '',
    '_Draft created by IIChE AI._',
  ].join('\n');

  const notes = str(args.additional_notes) || 'Draft created by IIChE AI.';
  const { data, error: insErr } = await ctx.supabase
    .from('event_reports')
    .insert({
      event_id: event.id,
      report_content: content,
      additional_notes: notes,
      additional_details: notes,
      created_by: ctx.userId,
    })
    .select('id')
    .single();

  if (insErr || !data) return `Could not create the report: ${insErr?.message || 'You may not have permission to write event reports.'}`;
  return `Created an event report for "${event.title}". Open ${ctx.origin}/dashboard/events/progress or /dashboard/reports to view it.`;
}

export async function createMinutes(ctx: IicheAiToolCtx, args: Record<string, unknown>): Promise<string> {
  const minutes = str(args.minutes);
  if (!minutes) return 'Write the minutes text so I can save them.';
  const meetingTitle = str(args.meeting_title) || str(args.title);
  let attached = '';
  let meetingId: string | undefined;
  let resolvedTitle = meetingTitle || 'Minutes of meeting';

  if (meetingTitle) {
    const { data: meetings } = await ctx.supabase
      .from('meetings')
      .select('id, title, meeting_date')
      .ilike('title', `%${meetingTitle}%`)
      .order('meeting_date', { ascending: false })
      .limit(1);
    const meeting = (meetings || [])[0] as { id: string; title: string; meeting_date?: string } | undefined;
    if (meeting) {
      meetingId = meeting.id;
      resolvedTitle = meeting.title;
      attached = ` Attached to meeting "${meeting.title}".`;
      await ctx.supabase.from('meetings').update({ minutes }).eq('id', meeting.id);
    }
  }

  const meetingDate = str(args.meeting_date) || new Date().toISOString();
  const { error: insErr } = await ctx.supabase.from('meeting_minutes').insert({
    title: resolvedTitle,
    content: minutes,
    meeting_date: meetingDate,
    created_by: ctx.userId,
    meeting_id: meetingId || null,
  });

  if (insErr) {
    const { error: legacyErr } = await ctx.supabase.from('meeting_minutes').insert({
      title: resolvedTitle,
      purpose: minutes.slice(0, 500),
      meeting_date: meetingDate.slice(0, 10),
      document_url: null,
      uploaded_by: ctx.userId,
    });
    if (legacyErr && !attached) {
      return `Could not save minutes: ${legacyErr.message}. You may need access to Minutes.`;
    }
  }
  return `Saved minutes of meeting.${attached} See ${ctx.origin}/dashboard/minutes and ${ctx.origin}/dashboard/meetings.`;
}

function rpcErr(error: { message?: string } | null | undefined): string {
  const raw = error?.message || 'Something went wrong';
  const m = raw.match(/EXCEPTION:\s*(.+?)$/i) || raw.match(/error:\s*(.+?)$/i);
  return (m?.[1] || raw).replace(/^.*ERROR:\s*/i, '').split('\n')[0];
}

export async function manageElection(ctx: IicheAiToolCtx, args: Record<string, unknown>): Promise<string> {
  let action = str(args.action).toLowerCase() || 'open';
  if (action === 'show_results' || action === 'publish') action = 'results';
  if (action === 'finalize_contestants' || action === 'finalise') action = 'finalize';
  if (action === 'open_voting' || action === 'start_voting') action = 'open';
  const { data: state, error: stErr } = await ctx.supabase.rpc('ec_election_state');
  if (stErr) return `Could not read election state: ${rpcErr(stErr)}`;
  const s = state as {
    can_manage?: boolean;
    can_finalize?: boolean;
    tab_visible?: boolean;
    status?: string;
    results_visible?: boolean;
    contestants_finalized?: boolean;
  };
  const go = 'NAVIGATE:/dashboard/election';
  if (!s?.can_manage) {
    return `${go} You do not have rights to ${action} the election. Only faculty or Social & Environmental members can. Opening the election page.`;
  }
  const fn: Record<string, string> = {
    start: 'ec_election_start',
    finalize: 'ec_election_finalize_contestants',
    open: 'ec_election_open_voting',
    stop: 'ec_election_stop',
    hide: 'ec_election_hide_tab',
    results: 'ec_election_show_results',
    new: 'ec_election_new',
  };
  if (action === 'finalize' && !s.can_finalize) {
    return `${go} Only faculty can finalize contestants.`;
  }
  if (action === 'open' && !s.contestants_finalized) {
    return `${go} Faculty must finalize contestants before voting can open.`;
  }
  if (action === 'open' && s.status === 'voting') {
    return `${go} Voting is already open.`;
  }
  if (action === 'start' && s.tab_visible && s.status === 'nominations' && !s.contestants_finalized) {
    return `${go} Contesting is already open. Names stay hidden until faculty finalizes.`;
  }
  const rpcName = fn[action];
  if (!rpcName) return `${go} Unknown election action "${action}". Use start, finalize, open, stop, hide, results, or new.`;
  const { error } = await ctx.supabase.rpc(rpcName);
  if (error) return `${go} Could not ${action} the election: ${rpcErr(error)}`;
  return `${go} Election ${action} succeeded.`;
}

export async function proposeEvent(ctx: IicheAiToolCtx, args: Record<string, unknown>): Promise<string> {
  const title = str(args.title);
  if (!title) return 'Give the event a title.';
  let when = str(args.event_date);
  if (!when) {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    d.setHours(17, 0, 0, 0);
    when = d.toISOString();
  } else if (!Number.isNaN(new Date(when).getTime())) {
    when = new Date(when).toISOString();
  } else {
    return 'I could not read that event date.';
  }

  const { data: membership } = await ctx.supabase
    .from('committee_members')
    .select('committee_id')
    .eq('user_id', ctx.userId)
    .neq('committee_id', '00000000-0000-0000-0000-000000000001')
    .limit(1)
    .maybeSingle();

  const { data: profile } = await ctx.supabase
    .from('profiles')
    .select('executive_role, is_faculty, is_admin')
    .eq('id', ctx.userId)
    .maybeSingle();

  const isExecutive = !!(profile as { executive_role?: string } | null)?.executive_role;
  const isFacultyOrAdmin = !!(profile as { is_faculty?: boolean; is_admin?: boolean } | null)?.is_faculty
    || !!(profile as { is_admin?: boolean } | null)?.is_admin;
  const initialStatus = isFacultyOrAdmin ? 'active' : isExecutive ? 'pending_faculty_approval' : 'pending_head_approval';

  const { data: inserted, error } = await ctx.supabase
    .from('events')
    .insert({
      title,
      description: str(args.description) || `Proposed via IIChE AI.`,
      date: when,
      event_date: when,
      location: str(args.location) || 'TBA',
      budget: Number(args.budget) > 0 ? Number(args.budget) : null,
      committee_id: (membership as { committee_id?: string } | null)?.committee_id || null,
      proposed_by: ctx.userId,
      status: initialStatus,
      created_by: ctx.userId,
      documents: [],
    })
    .select('id, title, committee_id')
    .single();

  if (error || !inserted) {
    return `Could not submit the proposal: ${error?.message || 'unknown error'}`;
  }
  try {
    if (initialStatus === 'pending_head_approval' && inserted.committee_id) {
      await notifyCommitteeHeads(ctx.supabase, inserted.committee_id, {
        type: 'proposal',
        title: 'New event proposal',
        message: `"${inserted.title}" was submitted with IIChE AI and needs head approval.`,
        link: `/dashboard/proposals`,
        related_id: inserted.id,
      });
    } else if (initialStatus === 'pending_faculty_approval') {
      await notifyFaculty(ctx.supabase, {
        type: 'proposal',
        title: 'New event proposal',
        message: `"${inserted.title}" needs faculty approval.`,
        link: `/dashboard/proposals`,
        related_id: inserted.id,
      });
    }
  } catch {
    /* ignore */
  }
  return `NAVIGATE:/dashboard/proposals Submitted proposal "${inserted.title}" (status: ${initialStatus.replace(/_/g, ' ')}).`;
}

export async function approveProposal(ctx: IicheAiToolCtx, args: Record<string, unknown>): Promise<string> {
  const q = str(args.event_title);
  let query = ctx.supabase
    .from('events')
    .select('id, title, status, committee_id, head_approved_by, proposed_by')
    .not('status', 'in', '(active,completed,cancelled)')
    .order('created_at', { ascending: false })
    .limit(8);
  if (q) query = query.ilike('title', `%${q}%`);
  const { data: events, error } = await query;
  if (error) return `Could not load proposals: ${error.message}`;
  const event = (events || [])[0] as
    | { id: string; title: string; status: string; committee_id?: string; head_approved_by?: string }
    | undefined;
  if (!event) return q ? `No pending proposal matched "${q}".` : 'There is no pending proposal to approve.';

  const { data: profile } = await ctx.supabase
    .from('profiles')
    .select('id, is_faculty, is_admin, executive_role, role')
    .eq('id', ctx.userId)
    .maybeSingle();
  const isFaculty = !!(profile as { is_faculty?: boolean } | null)?.is_faculty;
  const isAdmin = isPortalAdmin(profile);
  const executiveRole = (profile as { executive_role?: string } | null)?.executive_role || null;

  const { data: membership } = await ctx.supabase
    .from('committee_members')
    .select('position')
    .eq('user_id', ctx.userId)
    .eq('committee_id', event.committee_id || '')
    .maybeSingle();
  const isHead = isHeadPosition((membership as { position?: string } | null)?.position);

  const { data: wf } = await ctx.supabase.from('workflow_config').select('config').eq('workflow_type', 'approval_thresholds').maybeSingle();
  const t = normalizeProposalThresholds((wf as { config?: Record<string, unknown> } | null)?.config);

  const go = 'NAVIGATE:/dashboard/proposals';

  if (event.status === 'pending_head_approval') {
    if (!isFaculty && !isAdmin && !isHead) {
      return `${go} You cannot approve "${event.title}" yet — that step is for the committee head.`;
    }
    const nextStatus = t.proposal_head_approval === 'two_heads' ? 'pending_second_head_approval' : 'pending_ec_approval';
    const { error: u } = await ctx.supabase.from('events').update({
      status: nextStatus,
      head_approved_by: ctx.userId,
      head_approved_at: new Date().toISOString(),
    }).eq('id', event.id);
    if (u) return `${go} Could not approve: ${u.message}`;
    return `${go} Head-approved "${event.title}". Next: ${nextStatus.replace(/_/g, ' ')}.`;
  }

  if (event.status === 'pending_second_head_approval') {
    if (event.head_approved_by === ctx.userId) {
      return `${go} The second head approval must be a different person.`;
    }
    if (!isFaculty && !isAdmin && !isHead) {
      return `${go} You cannot give the second head approval for "${event.title}".`;
    }
    const { error: u } = await ctx.supabase.from('events').update({
      status: 'pending_ec_approval',
      second_head_approved_by: ctx.userId,
      second_head_approved_at: new Date().toISOString(),
    }).eq('id', event.id);
    if (u) return `${go} Could not approve: ${u.message}`;
    return `${go} Second head approved "${event.title}". Sent to EC.`;
  }

  if (event.status === 'pending_ec_approval') {
    if (!isFaculty && !isAdmin && !executiveRoleCountsForProposalEc(executiveRole, t.proposal_ec_approval)) {
      return `${go} You cannot record an EC approval for "${event.title}".`;
    }
    await ctx.supabase.from('ec_approvals').upsert({
      event_id: event.id,
      user_id: ctx.userId,
      approved: true,
      approved_at: new Date().toISOString(),
    });
    const { data: allApprovals } = await ctx.supabase
      .from('ec_approvals')
      .select('approved, profiles(executive_role)')
      .eq('event_id', event.id)
      .eq('approved', true);
    if (proposalEcSatisfied(t.proposal_ec_approval, allApprovals || [])) {
      await ctx.supabase.from('events').update({ status: 'pending_faculty_approval' }).eq('id', event.id);
      return `${go} EC approval complete for "${event.title}". Sent to faculty.`;
    }
    return `${go} Recorded your EC approval for "${event.title}". Waiting on remaining EC signatures.`;
  }

  if (event.status === 'pending_faculty_approval') {
    if (!isFaculty && !isAdmin) {
      return `${go} Faculty approval for "${event.title}" is limited to faculty/admin.`;
    }
    const { error: u } = await ctx.supabase.from('events').update({
      status: 'active',
      faculty_approved_by: ctx.userId,
      faculty_approved_at: new Date().toISOString(),
    }).eq('id', event.id);
    if (u) return `${go} Could not approve: ${u.message}`;
    return `${go} Faculty-approved "${event.title}". It is now active.`;
  }

  return `${go} "${event.title}" is in status ${event.status.replace(/_/g, ' ')}, which is not waiting on your approval.`;
}

export async function designPoster(ctx: IicheAiToolCtx, args: Record<string, unknown>): Promise<string> {
  const raw = str(args.event_title);
  const q = raw.replace(/\b(design|make|create|generate|upload|a|the|poster|for)\b/gi, ' ').replace(/\s+/g, ' ').trim();
  const blob = `${raw} ${q}`;
  const theme = resolvePosterTheme(blob);
  const themedSearch = theme.id !== 'general';

  let event: { id: string; title: string; event_date?: string; location?: string } | undefined;
  if (q && !/^(it|this|that)$/i.test(q) && !themedSearch) {
    const { data: events, error } = await ctx.supabase
      .from('events')
      .select('id, title, event_date, location')
      .ilike('title', `%${q}%`)
      .order('created_at', { ascending: false })
      .limit(1);
    if (error) return `Could not find events: ${error.message}`;
    event = (events || [])[0];
  }
  if (themedSearch && q) {
    const { data: events } = await ctx.supabase
      .from('events')
      .select('id, title, event_date, location')
      .ilike('title', `%${q.split(/\s+/)[0]}%`)
      .order('created_at', { ascending: false })
      .limit(1);
    const hit = (events || [])[0];
    if (hit && resolvePosterTheme(hit.title).id === theme.id) event = hit;
  }

  const title =
    event?.title && resolvePosterTheme(event.title).id === theme.id
      ? event.title
      : q || event?.title || 'IIChE Chapter Event';
  const dateLabel = event?.event_date
    ? formatPortalDate(event.event_date)
    : 'Date TBA';
  const location = event?.location || theme.venueDefault;
  const tagline = str(args.tagline) || theme.tagline;
  const registerLine = theme.registerPath
    ? `${(ctx.origin || '').replace(/\/$/, '')}${theme.registerPath}`
    : undefined;

  const dataUrl = await composeIichePoster({
    title,
    dateLabel,
    location,
    tagline,
    query: blob,
    variant: theme.id,
    registerLine,
    rules: theme.rules,
    cta: theme.cta,
    organizer: theme.organizer,
    photoQuery: theme.photoQuery,
  });
  const eventId = event?.id || 'none';
  const caption = [
    `Here is a designed poster for **${title}**.`,
    '',
    '| Field | Detail |',
    '| --- | --- |',
    `| Date | ${dateLabel} |`,
    `| Venue | ${location} |`,
    `| Details | ${theme.rules} |`,
    `| Call to action | ${theme.cta} |`,
    registerLine ? `| Register | ${registerLine} |` : null,
    `| Organized by | ${theme.organizer} |`,
    '',
    'It is only in this chat. Say **upload this poster** to put it on the event.',
  ]
    .filter((line) => line != null)
    .join('\n');
  return `POSTER:${dataUrl} DRAFT:inline|${eventId}|${encodeURIComponent(title)};; ${caption}`;
}

export async function uploadPoster(ctx: IicheAiToolCtx, args: Record<string, unknown>): Promise<string> {
  const draft = ctx.posterDraft;
  if (!draft?.eventId || draft.eventId === 'none') {
    return 'There is no event linked to this poster yet. Name the event, or create one, then say upload this poster.';
  }
  let path = draft.path && draft.path !== 'inline' ? draft.path : '';
  if (!path && draft.dataUrl?.startsWith('data:image/')) {
    const header = draft.dataUrl.slice(5, draft.dataUrl.indexOf(';')) || 'image/svg+xml';
    const b64 = draft.dataUrl.split(',')[1] || '';
    const ext = header.includes('png') ? 'png' : header.includes('jpeg') || header.includes('jpg') ? 'jpg' : 'svg';
    const body = ext === 'svg' ? Buffer.from(b64, 'base64').toString('utf8') : Buffer.from(b64, 'base64');
    path = `event-posters/${draft.eventId}-${Date.now()}.${ext}`;
    const { error: upErr } = await ctx.supabase.storage.from('event-documents').upload(path, body, {
      contentType: header,
      upsert: false,
    });
    if (upErr) return `Could not upload the poster: ${upErr.message}`;
  }
  if (!path) return 'There is no poster in this chat to upload yet. Ask me to create a poster first.';
  const { data: profile } = await ctx.supabase.from('profiles').select('is_admin, role, is_faculty').eq('id', ctx.userId).maybeSingle();
  const admin = isPortalAdmin(profile) || !!(profile as { is_faculty?: boolean } | null)?.is_faculty;
  const posterUpdate = admin
    ? {
        poster_url: path,
        poster_status: 'approved',
        poster_faculty_reviewed_at: new Date().toISOString(),
        poster_faculty_reviewed_by: ctx.userId,
      }
    : {
        poster_url: path,
        poster_status: 'pending_faculty_approval',
      };
  const { error: upd } = await ctx.supabase.from('events').update(posterUpdate).eq('id', draft.eventId);
  if (upd) return `Could not attach the poster: ${upd.message}`;
  const title = str(args.event_title) || draft.title || 'the event';
  return `NAVIGATE:/dashboard/event-detail/${draft.eventId} Uploaded the poster to ${title}.`;
}

const PORTAL_PAGES: { keys: string[]; path: string; label: string; note: string }[] = [
  {
    keys: ['election', 'elections', 'voting', 'vote', 'contest'],
    path: '/dashboard/election',
    label: 'EC election',
    note: 'After start, heads and co-heads contest. Names stay hidden until faculty finalizes. Faculty or Social & Environmental then open voting. Results publish when voting stops, time ends, or everyone has voted.',
  },
  { keys: ['propose-event', 'propose event', 'propose'], path: '/dashboard/propose-event', label: 'Propose event', note: 'Submit a new event proposal.' },
  { keys: ['proposal'], path: '/dashboard/proposals', label: 'Proposals', note: 'Track submitted event proposals.' },
  { keys: ['form'], path: '/dashboard/forms', label: 'Forms', note: 'Create and fill chapter forms.' },
  { keys: ['meeting'], path: '/dashboard/meetings', label: 'Meetings', note: 'Schedule or join meetings.' },
  { keys: ['task'], path: '/dashboard/tasks', label: 'Tasks', note: 'Committee task board.' },
  { keys: ['document', 'file'], path: '/dashboard/documents', label: 'Documents', note: 'Shared files.' },
  { keys: ['account', 'finance', 'expense'], path: '/dashboard/accounts', label: 'Accounts', note: 'Expenses and receipts.' },
  { keys: ['minute', 'mom'], path: '/dashboard/minutes', label: 'Minutes', note: 'Minutes of meeting.' },
  { keys: ['kickoff'], path: '/dashboard/kickoff', label: 'Kickoff', note: 'Tournament tools.' },
  { keys: ['profile'], path: '/dashboard/profile', label: 'Profile', note: 'Your account details.' },
  { keys: ['report'], path: '/dashboard/reports', label: 'Reports', note: 'Event reports.' },
  { keys: ['chat', 'message'], path: '/dashboard/chat', label: 'Chat', note: 'Chapter chat.' },
  { keys: ['hiring'], path: '/dashboard/hiring', label: 'Hiring', note: 'Committee hiring.' },
  { keys: ['poster'], path: '/dashboard/posters', label: 'Posters', note: 'Poster tools.' },
  { keys: ['member profile', 'member-profiles', 'bios', 'profile photo'], path: '/dashboard/member-profiles', label: 'Member profiles', note: 'Graphics and admins add photos and bios for members.' },
  { keys: ['dashboard', 'home'], path: '/dashboard', label: 'Dashboard', note: 'Chapter home.' },
];

export function resolvePortalPage(query: string): { path: string; label: string; note: string } {
  const q = query.trim().toLowerCase();
  const hit = PORTAL_PAGES.find((p) => p.keys.some((k) => q.includes(k)));
  return hit || PORTAL_PAGES[PORTAL_PAGES.length - 1];
}

export async function openPortalPage(_ctx: IicheAiToolCtx, args: Record<string, unknown>): Promise<string> {
  const page = resolvePortalPage(str(args.page) || str(args.path) || 'dashboard');
  return `NAVIGATE:${page.path} Opening ${page.label} at ${page.path}. ${page.note}`;
}

export async function runIicheAiTool(ctx: IicheAiToolCtx, name: string, args: Record<string, unknown>): Promise<string> {
  switch (name) {
    case 'get_committee_officers':
      return getCommitteeOfficers(ctx, str(args.committee_name));
    case 'get_my_identity':
      return getMyIdentity(ctx);
    case 'open_portal_page':
      return openPortalPage(ctx, args);
    case 'manage_election':
      return manageElection(ctx, args);
    case 'propose_event':
      return proposeEvent(ctx, args);
    case 'approve_proposal':
      return approveProposal(ctx, args);
    case 'design_poster':
      return designPoster(ctx, args);
    case 'upload_poster':
      return uploadPoster(ctx, args);
    case 'create_form':
      return createForm(ctx, args);
    case 'create_meeting':
      return createMeeting(ctx, args);
    case 'create_event_report':
      return createEventReport(ctx, args);
    case 'create_minutes':
      return createMinutes(ctx, args);
    case 'list_events':
      return listEvents(ctx, str(args.query));
    default:
      return `Unknown tool ${name}`;
  }
}

export function maybeHeuristicTool(message: string): { name: string; args: Record<string, unknown> } | null {
  const m = message.trim();
  const lower = m.toLowerCase().replace(/[?.!]+$/g, '');
  if (
    /\bwho am i\b/.test(lower) ||
    /\bwho'm i\b/.test(lower) ||
    /\bwhat(?:'s| is) my (name|role|position|email|status|committee|committees)\b/.test(lower) ||
    /\bwhich committee am i\b/.test(lower) ||
    /\bam i (an |a )?(admin|faculty|head|co[-\s]?head)\b/.test(lower) ||
    (/\bmy (name|role|committees?|position)\b/.test(lower) && /\b(what|who|tell|show)\b/.test(lower))
  ) {
    return { name: 'get_my_identity', args: {} };
  }
  const wantsCreate = /\b(create|ceate|make|add|new|schedule|write|save)\b/.test(lower);
  const askingHow =
    /\b(how do i|how does|how can|how to|explain|tell me about|what is the|what are the|what's the)\b/.test(
      lower,
    ) && !/\b(open|go to|take me|start|begin|stop|end|finali[sz]e|launch|enable|close voting)\b/.test(lower);
  if (/\b(election|elections|voting)\b/.test(lower) && !wantsCreate && !askingHow) {
    if (/\b(stop|end|close voting)\b/.test(lower)) return { name: 'manage_election', args: { action: 'stop' } };
    if (/\bfinali[sz]e\b/.test(lower)) return { name: 'manage_election', args: { action: 'finalize' } };
    if (/\b(start|begin)\b/.test(lower)) return { name: 'manage_election', args: { action: 'start' } };
    if (/\b(open|launch|enable)\b/.test(lower) || /\belections? section\b/.test(lower)) {
      return { name: 'manage_election', args: { action: 'open' } };
    }
  }
  if (
    /\b(propose|proposal)\b/.test(lower) &&
    /\bevent\b/.test(lower) &&
    !/\bapprov/.test(lower) &&
    !askingHow
  ) {
    const titled = m.match(/(?:event|proposal) (?:called|named|titled|:)\s*["']?(.+?)["']?$/i) || m.match(/["'](.+?)["']/);
    return { name: 'propose_event', args: { title: titled?.[1]?.trim() || 'Untitled event', description: m } };
  }
  if (/\bapprov/.test(lower) && /\b(proposal|event|propos)/.test(lower)) {
    const titled = m.match(/(?:proposal|event|propos(?:al)?)\s+(?:for\s+)?["']?(.+?)["']?$/i);
    return { name: 'approve_proposal', args: { event_title: titled?.[1]?.trim() || '' } };
  }
  if (/\bposter\b/.test(lower) && /\b(upload|attach|publish|save this|save the|use this)\b/.test(lower)) {
    return { name: 'upload_poster', args: {} };
  }
  if (/\bposter\b/.test(lower) && /\b(design|make|create|generate)\b/.test(lower) && !askingHow) {
    const titled = m.match(/poster (?:for|of)\s+["']?(.+?)["']?$/i);
    let eventTitle = titled?.[1]?.trim() || '';
    if (!eventTitle || /^(it|this|that|me|us)$/i.test(eventTitle)) {
      eventTitle = m
        .replace(/\b(please|we are going to|going to|conduct|through iiche|iiche|design|make|create|generate|upload|a|the|poster|for|me|it)\b/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }
    return { name: 'design_poster', args: { event_title: eventTitle } };
  }
  const wantsOpen = /\b(open|go to|take me|where is|where are|navigate)\b/.test(lower)
    || /\bshow me (the )?(page|tab|section|election|voting|forms?|meetings?)\b/.test(lower);
  if (wantsOpen && !wantsCreate && !askingHow) {
    if (/\b(election|elections|voting|vote|contest)\b/.test(lower)) {
      return { name: 'open_portal_page', args: { page: 'election' } };
    }
    const page = resolvePortalPage(lower);
    if (page.path !== '/dashboard' || /\bdashboard\b/.test(lower)) {
      return { name: 'open_portal_page', args: { page: page.path } };
    }
  }
  const officers =
    /\b(co[-\s]?heads?|heads?|officers?)\b/.test(lower) &&
    (/\bcommitte?e?s?\b/.test(lower) || /\b(who|which|list)\b/.test(lower) || /\b(of|for)\s+(the\s+)?/.test(lower));
  if (
    !wantsCreate &&
    !askingHow &&
    /\bevents?\b/.test(lower) &&
    /\b(upcoming|list|which|show me|do we have|have we|scheduled|latest)\b/.test(lower) &&
    !/\b(ideas?|propose|proposal|poster|report)\b/.test(lower)
  ) {
    const named = m.match(/(?:events?|named|called|titled)\s+["']?(.+?)["']?$/i);
    return { name: 'list_events', args: { query: named?.[1]?.trim() || '' } };
  }
  if (officers && !wantsCreate) {
    let name = 'this';
    if (/\bthis\s+committe?e?\b/.test(lower) || /\bmy\s+committe?e?\b/.test(lower) || /\bour\s+committe?e?\b/.test(lower)) {
      name = 'this';
    } else {
      const of = lower.match(/(?:of|for)\s+(?:the\s+)?(.+?)(?:\s+committe?e?s?)?[?.!]*$/i);
      name = (of?.[1] || 'this').replace(/\s+committe?e?s?\s*$/i, '').trim() || 'this';
    }
    return { name: 'get_committee_officers', args: { committee_name: name } };
  }
  if (wantsCreate && !askingHow && /\bform\b/.test(lower)) {
    const titled = m.match(/form (?:called|named|titled|:)\s*["']?(.+?)["']?$/i) || m.match(/["'](.+?)["']\s*form/i);
    return { name: 'create_form', args: { title: titled?.[1]?.trim() || 'Untitled form', description: m } };
  }
  if (wantsCreate && !askingHow && /\bmeeting\b/.test(lower)) {
    const titled = m.match(/meeting (?:called|named|titled|:)\s*["']?(.+?)["']?/i);
    return { name: 'create_meeting', args: { title: titled?.[1]?.trim() || 'Committee meeting' } };
  }
  if (wantsCreate && !askingHow && /\b(event report|report)\b/.test(lower) && !/\bform\b/.test(lower)) {
    const titled = m.match(/report (?:for|on)\s+["']?(.+?)["']?$/i);
    return { name: 'create_event_report', args: { event_title: titled?.[1]?.trim() || m } };
  }
  if (wantsCreate && !askingHow && /\b(mom|minutes|minutes of meeting)\b/.test(lower)) {
    return { name: 'create_minutes', args: { title: 'Minutes of meeting', minutes: m } };
  }
  return null;
}
