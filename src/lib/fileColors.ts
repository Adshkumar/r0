import { resolveFileIcon } from './fileIcons';

export function fileColor(name: string): string {
  return resolveFileIcon(name, false, false, 'r0').color;
}
