export const FORM_PAGES_META_KEY = '_pages';

export type FormPage = {
  id: string;
  title: string;
  description?: string;
  /** Button/link shown after this page is submitted, if another page follows. */
  continueLabel?: string;
};

export type PagedFormField = {
  id: string;
  page_id?: string | null;
};

export function newFormPageId() {
  return `p_${Math.random().toString(36).slice(2, 10)}`;
}

export function blankFormPage(title = 'Page 1'): FormPage {
  return {
    id: newFormPageId(),
    title,
    continueLabel: 'Continue to next page',
  };
}

function asPage(raw: unknown, index: number): FormPage | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const id = String(row.id || '').trim();
  if (!id) return null;
  const title = String(row.title || '').trim() || `Page ${index + 1}`;
  const description = String(row.description || '').trim();
  const continueLabel = String(row.continueLabel || row.continue_label || '').trim() || 'Continue to next page';
  return { id, title, description: description || undefined, continueLabel };
}

/** Existing forms with no pages config act as a single page. */
export function normalizeFormPages(settings: unknown, fields?: PagedFormField[] | null): FormPage[] {
  const s = settings && typeof settings === 'object' ? (settings as Record<string, unknown>) : {};
  const raw = s.pages;
  if (Array.isArray(raw)) {
    const pages = raw.map(asPage).filter((p): p is FormPage => !!p);
    if (pages.length > 0) return pages;
  }
  const firstFieldPage = (fields || []).map((f) => String(f.page_id || '').trim()).find(Boolean);
  return [{ id: firstFieldPage || 'p_default', title: 'Page 1', continueLabel: 'Continue to next page' }];
}

export function fieldsOnPage<T extends PagedFormField>(fields: T[], page: FormPage, pages: FormPage[]): T[] {
  if (pages.length <= 1) return fields;
  const fallback = pages[0]?.id;
  return fields.filter((f) => (String(f.page_id || '').trim() || fallback) === page.id);
}

/** Titles of pages that have no questions (skipped for single-page forms). */
export function pagesMissingQuestions<T extends PagedFormField>(pages: FormPage[], fields: T[]): string[] {
  if (pages.length <= 1) return [];
  return pages
    .filter((p) => fieldsOnPage(fields, p, pages).length === 0)
    .map((p) => p.title || 'Untitled page');
}

export function pageIndex(pages: FormPage[], pageId: string | null | undefined) {
  const i = pages.findIndex((p) => p.id === pageId);
  return i < 0 ? 0 : i;
}

export function resolveFormPage(pages: FormPage[], pageId: string | null | undefined): FormPage {
  return pages.find((p) => p.id === pageId) || pages[0];
}

export function nextFormPage(pages: FormPage[], pageId: string | null | undefined): FormPage | null {
  const i = pageIndex(pages, pageId);
  return pages[i + 1] || null;
}

export function completedPageIds(responses: unknown): string[] {
  if (!responses || typeof responses !== 'object') return [];
  const raw = (responses as Record<string, unknown>)[FORM_PAGES_META_KEY];
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => String(x || '').trim()).filter(Boolean);
}

export function isFormFullyComplete(pages: FormPage[], responses: unknown): boolean {
  if (pages.length <= 1) return true;
  const done = new Set(completedPageIds(responses));
  return pages.every((p) => done.has(p.id));
}

export function firstIncompletePage(pages: FormPage[], responses: unknown): FormPage | null {
  const done = new Set(completedPageIds(responses));
  return pages.find((p) => !done.has(p.id)) || null;
}

export function stripFormPageMeta(answers: Record<string, unknown> | null | undefined): Record<string, unknown> {
  if (!answers) return {};
  const next = { ...answers };
  delete next[FORM_PAGES_META_KEY];
  return next;
}

export function formPageFillPath(formId: string, pageId: string, responseId?: string | null) {
  const q = new URLSearchParams();
  q.set('page', pageId);
  if (responseId) q.set('rid', responseId);
  return `/forms/${formId}?${q.toString()}`;
}
