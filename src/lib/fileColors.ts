import { resolveFileIcon } from './fileIcons';
import type { FileIconTheme } from './fileIconTheme';

export function fileColor(name: string, theme: FileIconTheme = 'r0'): string {
  return resolveFileIcon(name, false, false, theme).color;
}
