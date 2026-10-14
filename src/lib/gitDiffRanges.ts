import { Change, diff } from '@codemirror/merge';
import type { GitDiffHunk } from './git';

function lineOffsets(content: string): number[] {
  const offsets = [0];
  for (let index = 0; index < content.length; index += 1) {
    if (content[index] === '\n') offsets.push(index + 1);
  }
  return offsets;
}

function offsetAtLine(offsets: number[], contentLength: number, line: number): number {
  return offsets[line] ?? contentLength;
}

export function gitHunksToChanges(oldContent: string, newContent: string, hunks: GitDiffHunk[]): Change[] {
  const oldOffsets = lineOffsets(oldContent);
  const newOffsets = lineOffsets(newContent);
  return hunks.flatMap(hunk => {
    const oldStartLine = hunk.old_lines === 0 ? hunk.old_start : hunk.old_start - 1;
    const newStartLine = hunk.new_lines === 0 ? hunk.new_start : hunk.new_start - 1;
    const fromA = offsetAtLine(oldOffsets, oldContent.length, oldStartLine);
    const toA = offsetAtLine(oldOffsets, oldContent.length, oldStartLine + hunk.old_lines);
    const fromB = offsetAtLine(newOffsets, newContent.length, newStartLine);
    const toB = offsetAtLine(newOffsets, newContent.length, newStartLine + hunk.new_lines);
    return diff(oldContent.slice(fromA, toA), newContent.slice(fromB, toB))
      .map(change => new Change(
        fromA + change.fromA,
        fromA + change.toA,
        fromB + change.fromB,
        fromB + change.toB,
      ));
  });
}
