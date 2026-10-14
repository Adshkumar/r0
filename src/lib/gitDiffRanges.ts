import { Change, diff } from '@codemirror/merge';
import type { GitDiffHunk } from './git';

const MAX_WORD_DIFF_CHARS = 16_384;

function wordAt(value: string, position: number): string | null {
  if (position < 0 || position >= value.length) return null;
  let start = position;
  const code = value.charCodeAt(position);
  if (code >= 0xdc00 && code <= 0xdfff && position > 0) {
    const high = value.charCodeAt(position - 1);
    if (high >= 0xd800 && high <= 0xdbff) start -= 1;
  }
  const codePoint = value.codePointAt(start);
  if (codePoint === undefined) return null;
  const point = String.fromCodePoint(codePoint);
  return /[\p{L}\p{N}_]/u.test(point) ? point : null;
}

function expandChangedTokens(oldText: string, newText: string, changes: readonly Change[]): Change[] {
  const expanded = changes.map(change => {
    let { fromA, toA, fromB, toB } = change;
    if (fromA < toA && fromB < toB) {
      while (fromA > 0 && fromB > 0) {
        const oldWord = wordAt(oldText, fromA - 1);
        const newWord = wordAt(newText, fromB - 1);
        if (!oldWord || oldWord !== newWord) break;
        fromA -= oldWord.length;
        fromB -= newWord.length;
      }
      while (toA < oldText.length && toB < newText.length) {
        const oldWord = wordAt(oldText, toA);
        const newWord = wordAt(newText, toB);
        if (!oldWord || oldWord !== newWord) break;
        toA += oldWord.length;
        toB += newWord.length;
      }
    }
    return new Change(fromA, toA, fromB, toB);
  });

  const merged: Change[] = [];
  for (const change of expanded) {
    const previous = merged[merged.length - 1];
    if (previous && change.fromA <= previous.toA && change.fromB <= previous.toB) {
      merged[merged.length - 1] = new Change(
        previous.fromA,
        Math.max(previous.toA, change.toA),
        previous.fromB,
        Math.max(previous.toB, change.toB),
      );
    } else {
      merged.push(change);
    }
  }
  return merged;
}

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
    const oldText = oldContent.slice(fromA, toA);
    const newText = newContent.slice(fromB, toB);
    const changes = Math.max(oldText.length, newText.length) > MAX_WORD_DIFF_CHARS
      ? [new Change(0, oldText.length, 0, newText.length)]
      : expandChangedTokens(oldText, newText, diff(oldText, newText));
    return changes
      .map(change => new Change(
        fromA + change.fromA,
        fromA + change.toA,
        fromB + change.fromB,
        fromB + change.toB,
      ));
  });
}
