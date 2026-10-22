import { describe, expect, it } from 'vitest';
import { imageFilesFromList, isImageFile } from '@/lib/event-photos';

describe('event photo files', () => {
  it('keeps every image from a multi-file list, not only the first', () => {
    const files = [
      new File(['a'], 'one.jpg', { type: 'image/jpeg' }),
      new File(['b'], 'two.png', { type: 'image/png' }),
      new File(['c'], 'notes.txt', { type: 'text/plain' }),
      new File(['d'], 'three.webp', { type: 'image/webp' }),
    ];
    const images = imageFilesFromList(files);
    expect(images.map((f) => f.name)).toEqual(['one.jpg', 'two.png', 'three.webp']);
  });

  it('accepts image files even when the MIME type is empty', () => {
    expect(isImageFile(new File(['x'], 'shot.HEIC', { type: '' }))).toBe(true);
  });
});
