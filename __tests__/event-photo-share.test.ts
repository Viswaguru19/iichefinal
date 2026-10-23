import { describe, expect, it } from 'vitest';
import { eventPhotoSharePath, eventPhotoShareUrl } from '@/lib/event-photo-share';

describe('event photo share links', () => {
  it('builds a public path from the token', () => {
    expect(eventPhotoSharePath('abc123')).toBe('/photos/abc123');
  });

  it('prefixes origin when provided', () => {
    expect(eventPhotoShareUrl('abc123', 'https://iiche.example')).toBe('https://iiche.example/photos/abc123');
  });
});
