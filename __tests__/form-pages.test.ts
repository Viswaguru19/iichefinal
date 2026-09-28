import { describe, expect, it } from 'vitest';
import {
  completedPageIds,
  fieldsOnPage,
  firstIncompletePage,
  formPageFillPath,
  isFormFullyComplete,
  nextFormPage,
  normalizeFormPages,
  pagesMissingQuestions,
  resolveFormPage,
  stripFormPageMeta,
} from '@/lib/form-pages';

const pages = [
  { id: 'p1', title: 'Details', continueLabel: 'Go to preferences' },
  { id: 'p2', title: 'Preferences', continueLabel: 'Continue to next page' },
];

describe('form pages', () => {
  it('treats forms without pages as a single page', () => {
    const one = normalizeFormPages({});
    expect(one).toHaveLength(1);
    expect(one[0].title).toBe('Page 1');
  });

  it('keeps questions on the page they belong to', () => {
    const fields = [
      { id: 'a', page_id: 'p1' },
      { id: 'b', page_id: 'p2' },
      { id: 'c' },
    ];
    expect(fieldsOnPage(fields, pages[0], pages).map((f) => f.id)).toEqual(['a', 'c']);
    expect(fieldsOnPage(fields, pages[1], pages).map((f) => f.id)).toEqual(['b']);
  });

  it('builds a continue link to the next page after submit', () => {
    expect(nextFormPage(pages, 'p1')?.id).toBe('p2');
    expect(nextFormPage(pages, 'p2')).toBeNull();
    expect(formPageFillPath('form-1', 'p2', 'resp-9')).toBe('/forms/form-1?page=p2&rid=resp-9');
  });

  it('knows when every page has been submitted', () => {
    const partial = { Name: 'A', _pages: ['p1'] };
    expect(isFormFullyComplete(pages, partial)).toBe(false);
    expect(firstIncompletePage(pages, partial)?.id).toBe('p2');
    expect(isFormFullyComplete(pages, { ...partial, _pages: ['p1', 'p2'] })).toBe(true);
    expect(isFormFullyComplete(normalizeFormPages({}), { Name: 'A' })).toBe(true);
  });

  it('flags pages that have no questions', () => {
    expect(pagesMissingQuestions(pages, [{ id: 'a', page_id: 'p1' }])).toEqual(['Preferences']);
    expect(pagesMissingQuestions(pages, [{ id: 'a', page_id: 'p1' }, { id: 'b', page_id: 'p2' }])).toEqual([]);
    expect(pagesMissingQuestions(normalizeFormPages({}), [])).toEqual([]);
  });

  it('hides page bookkeeping from response tables', () => {
    expect(stripFormPageMeta({ Name: 'A', _pages: ['p1'] })).toEqual({ Name: 'A' });
    expect(completedPageIds({ _pages: ['p1', ''] })).toEqual(['p1']);
    expect(resolveFormPage(pages, 'missing').id).toBe('p1');
  });
});
