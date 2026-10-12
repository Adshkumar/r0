import { describe, expect, it } from 'vitest';
import { getImageMimeType, isImageFile } from '../imagePreview';

describe('image preview file types', () => {
  it.each([
    ['C:\\project\\avatar.PNG', 'image/png'],
    ['/project/assets/photo.jpeg', 'image/jpeg'],
    ['/project/public/vite.svg', 'image/svg+xml'],
    ['/project/animation.webp', 'image/webp'],
    ['/project/icon.ico', 'image/x-icon'],
  ])('recognizes %s', (path, mimeType) => {
    expect(getImageMimeType(path)).toBe(mimeType);
    expect(isImageFile(path)).toBe(true);
  });

  it('does not classify unsupported files as images', () => {
    expect(getImageMimeType('/project/src/main.ts')).toBeNull();
    expect(isImageFile('/project/README.md')).toBe(false);
  });
});
