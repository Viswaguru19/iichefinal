import { describe, expect, it } from 'vitest';
import { fallbackIicheAiReply, shouldRunHeuristicBeforeModel, splitPortalNavigate } from '@/lib/iiche-ai';
import { maybeHeuristicTool } from '@/lib/iiche-ai-actions';
import { iicheAiReplyPlain, parseIicheAiReply } from '@/lib/iiche-ai-format';
import { buildIichePosterSvg, pickPosterHeroUrl, resolvePosterTheme, svgDataUrl } from '@/lib/iiche-ai-poster';

describe('IIChE AI guide', () => {
  it('points members to propose-event for event questions', () => {
    expect(fallbackIicheAiReply('How do I propose an event?')).toContain('/dashboard/propose-event');
  });

  it('explains election roles without inventing results', () => {
    const reply = fallbackIicheAiReply('Can I contest secretary?');
    expect(reply.toLowerCase()).toContain('heads contest');
    expect(reply.toLowerCase()).toContain('secretary');
    expect(reply).toContain('/dashboard/election');
  });

  it('falls back to a greeting for unknown questions', () => {
    expect(fallbackIicheAiReply('xyz-unknown')).toContain('IIChE AI');
  });

  it('does not treat “this” as a hello, and answers how-are-you', () => {
    expect(fallbackIicheAiReply('heads of this committee')).not.toContain('Ask me anything');
    expect(fallbackIicheAiReply('how are you').toLowerCase()).toContain("i'm doing well");
  });

  it('does not steal academic questions with portal keywords', () => {
    expect(fallbackIicheAiReply('electron configuration of iron')).not.toContain('/dashboard/election');
    expect(fallbackIicheAiReply('help me formulate a research question')).not.toContain('/dashboard/forms');
    expect(fallbackIicheAiReply('I have a calculation task on mass transfer')).not.toContain('/dashboard/tasks');
    expect(fallbackIicheAiReply('Explain McCabe-Thiele step by step')).not.toContain('/dashboard');
  });
});

describe('IIChE AI tool heuristics', () => {
  it('opens the election when asked, instead of refusing', () => {
    const hit = maybeHeuristicTool('open election');
    expect(hit?.name).toBe('manage_election');
    expect(hit?.args.action).toBe('open');
    expect(maybeHeuristicTool('open the elections section')?.name).toBe('manage_election');
    expect(maybeHeuristicTool('where is the voting tab')?.name).toBe('open_portal_page');
  });

  it('detects propose, approve, and poster actions', () => {
    expect(maybeHeuristicTool('Propose an event called Chem Week')?.name).toBe('propose_event');
    expect(maybeHeuristicTool('Approve the proposal for Orientation')?.name).toBe('approve_proposal');
    expect(maybeHeuristicTool('Design a poster for Orientation')?.name).toBe('design_poster');
    expect(maybeHeuristicTool('upload this poster')?.name).toBe('upload_poster');
  });

  it('detects co-head lookups', () => {
    const hit = maybeHeuristicTool('Who are all the co heads of this committee');
    expect(hit?.name).toBe('get_committee_officers');
    expect(String(hit?.args.committee_name).toLowerCase()).toContain('this');
    expect(maybeHeuristicTool('heads of this committee')?.name).toBe('get_committee_officers');
    expect(maybeHeuristicTool('who is the head of Program')?.name).toBe('get_committee_officers');
  });

  it('detects form creation', () => {
    expect(maybeHeuristicTool('Create a form called Guest Feedback')?.name).toBe('create_form');
    expect(maybeHeuristicTool('ceate a form')?.name).toBe('create_form');
  });

  it('detects meeting, report, and minutes creation', () => {
    expect(maybeHeuristicTool('Schedule a new meeting')?.name).toBe('create_meeting');
    expect(maybeHeuristicTool('Create an event report for Orientation')?.name).toBe('create_event_report');
    expect(maybeHeuristicTool('Write MOM for today')?.name).toBe('create_minutes');
  });

  it('does not treat research or idea questions as portal writes', () => {
    expect(maybeHeuristicTool('list upcoming events')?.name).toBe('list_events');
    expect(maybeHeuristicTool('what events do we have')?.name).toBe('list_events');
    expect(maybeHeuristicTool('Give me event ideas for Chemical Engineering week')).toBeNull();
    expect(maybeHeuristicTool('Explain McCabe-Thiele step by step')).toBeNull();
    expect(maybeHeuristicTool('Help me research membrane bioreactors')).toBeNull();
    expect(maybeHeuristicTool('How does the election work?')).toBeNull();
    expect(maybeHeuristicTool('What is the election process?')).toBeNull();
    expect(maybeHeuristicTool('Who can vote?')).toBeNull();
    expect(maybeHeuristicTool('How do I propose an event?')).toBeNull();
    expect(maybeHeuristicTool('How do I create a form?')).toBeNull();
  });

  it('lets the model handle a mixed research-plus-portal question', () => {
    const guessed = maybeHeuristicTool('Who is the head of Program and also explain McCabe-Thiele');
    expect(guessed?.name).toBe('get_committee_officers');
    expect(shouldRunHeuristicBeforeModel('Who is the head of Program and also explain McCabe-Thiele', guessed!)).toBe(
      false,
    );
  });

  it('answers who-am-I from the signed-in profile instead of opening Profile', () => {
    expect(maybeHeuristicTool('who am i')?.name).toBe('get_my_identity');
    expect(maybeHeuristicTool("what's my name")?.name).toBe('get_my_identity');
    expect(maybeHeuristicTool('open my profile')?.name).toBe('open_portal_page');
  });
});

describe('IIChE AI reply formatting', () => {
  it('strips markdown stars from co-head replies', () => {
    const raw =
      'The co-heads of the **Program Committee** are:\n* **Abhinav R**\n* **Pranavika Shakhith**\n*(For context, headed by Tracy)*';
    const plain = iicheAiReplyPlain(raw);
    expect(plain).not.toContain('*');
    expect(plain).toContain('Abhinav R');
    expect(parseIicheAiReply(raw).some((b) => b.t === 'li')).toBe(true);
    expect(
      parseIicheAiReply(raw).some((b) => 'children' in b && b.children.some((c) => c.t === 'b' && c.v === 'Program Committee')),
    ).toBe(true);
  });

  it('renders designed poster data URLs in chat', () => {
    const svg = buildIichePosterSvg({
      title: 'Chem Week',
      dateLabel: '12 October 2026',
      location: 'AB2 Seminar Hall',
      tagline: 'IGNITE · INNOVATE · INSPIRE',
      heroDataUrl: 'data:image/jpeg;base64,/9j/4AAQ',
    });
    expect(svg).toContain('CHEM WEEK');
    expect(svg).toContain('data:image/jpeg');
    expect(pickPosterHeroUrl('IDP Orientation')).toContain('images.unsplash.com');
    const url = svgDataUrl(svg);
    const split = splitPortalNavigate(`POSTER:${url} DRAFT:inline|evt-1|Chem%20Week;; Here is a designed poster.`);
    expect(split.posterDraft?.eventId).toBe('evt-1');
    expect(split.posterDraft?.dataUrl).toMatch(/^data:image\/svg\+xml;base64,/);
    expect(split.posterUrl).toMatch(/^data:image\//);
    expect(split.reply).toContain('designed poster');
    expect(splitPortalNavigate('Hello\n\n- one\n- two').reply).toContain('\n- one');
    expect(pickPosterHeroUrl('Kickoff Football Tournament')).toMatch(/unsplash/);
    const football = buildIichePosterSvg({
      title: 'Kickoff Football Tournament',
      dateLabel: '12 October 2026',
      location: 'Amrita Grounds',
      tagline: 'PLAY · COMPETE · CELEBRATE',
      variant: 'football',
      registerLine: 'https://example.com/kickoff/register',
      rules: 'Teams of 7–11 players  ·  Open to all students',
    });
    expect(football).toContain('KICKOFF');
    expect(football).toContain('FOOTBALL TOURNAMENT');
    expect(football).toContain('REGISTER YOUR TEAM');
    expect(football).toContain('7–11');
    expect(football).toContain('kickoff/register');
    expect(maybeHeuristicTool('make me a poster for a kick off football tournament')?.name).toBe('design_poster');
    expect(resolvePosterTheme('Inter-hostel Cricket Tournament').id).toBe('cricket');
    expect(resolvePosterTheme('Python Workshop').id).toBe('workshop');
    expect(pickPosterHeroUrl('Inter-hostel Cricket Tournament')).not.toBe(pickPosterHeroUrl('Kickoff Football Tournament'));
    const cricket = buildIichePosterSvg({
      title: 'Inter-hostel Cricket Tournament',
      dateLabel: 'Date TBA',
      location: 'Amrita Grounds',
      tagline: 'PLAY · COMPETE · CELEBRATE',
    });
    expect(cricket).toMatch(/CRICKET/i);
    expect(cricket).toContain('REGISTER YOUR TEAM');
    const workshop = buildIichePosterSvg({
      title: 'Python Workshop',
      dateLabel: 'Date TBA',
      location: 'AB2 Seminar Hall',
      tagline: 'LEARN · BUILD · GROW',
    });
    expect(workshop).toMatch(/PYTHON/i);
    expect(workshop).toContain('REGISTER NOW');
    expect(workshop).toContain('Hands-on');
  });

  it('keeps lists and tables in replies', () => {
    const blocks = parseIicheAiReply(
      '## Ideas\n\n1. First\n2. Second\n\n| Date | Venue |\n| --- | --- |\n| 12 Oct | AB2 |',
    );
    expect(blocks.some((b) => b.t === 'h')).toBe(true);
    expect(blocks.filter((b) => b.t === 'li' && 'n' in b && b.n === 1).length).toBe(1);
    const table = blocks.find((b) => b.t === 'table');
    expect(table?.t === 'table' && table.headers).toEqual(['Date', 'Venue']);
    expect(table?.t === 'table' && table.rows[0]).toEqual(['12 Oct', 'AB2']);
  });
});
