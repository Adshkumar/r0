import { describe, expect, it } from 'vitest';
import { Chunk } from '@codemirror/merge';
import { Text } from '@codemirror/state';
import { gitHunksToChanges } from '../gitDiffRanges';

function buildGitChunks(oldContent: string, newContent: string, hunks: Parameters<typeof gitHunksToChanges>[2]) {
  const oldDoc = Text.of(oldContent.split('\n'));
  const newDoc = Text.of(newContent.split('\n'));
  return Chunk.build(oldDoc, newDoc, {
    override: () => gitHunksToChanges(oldContent, newContent, hunks),
  });
}

function chunkLines(chunks: ReturnType<typeof buildGitChunks>, oldContent: string, newContent: string) {
  const oldDoc = Text.of(oldContent.split('\n'));
  const newDoc = Text.of(newContent.split('\n'));
  return chunks.map(chunk => [
    oldDoc.lineAt(chunk.fromA).number,
    oldDoc.lineAt(chunk.endA).number,
    newDoc.lineAt(chunk.fromB).number,
    newDoc.lineAt(chunk.endB).number,
  ]);
}

describe('git hunk range conversion', () => {
  it('keeps identical revisions change-free', () => {
    expect(gitHunksToChanges('same\n', 'same\n', [])).toEqual([]);
    expect(buildGitChunks('same\n', 'same\n', [])).toEqual([]);
  });

  it('maps an added line to only its insertion range', () => {
    const changes = gitHunksToChanges(
      'before\nend\n',
      'before\nadded\nend\n',
      [{ old_start: 1, old_lines: 0, new_start: 2, new_lines: 1 }],
    );
    expect(changes.map(({ fromA, toA, fromB, toB }) => [fromA, toA, fromB, toB]))
      .toEqual([[7, 7, 7, 13]]);
  });

  it('maps a removed line to only its deletion range', () => {
    const changes = gitHunksToChanges(
      'before\nremoved\nend\n',
      'before\nend\n',
      [{ old_start: 2, old_lines: 1, new_start: 1, new_lines: 0 }],
    );
    expect(changes.map(({ fromA, toA, fromB, toB }) => [fromA, toA, fromB, toB]))
      .toEqual([[7, 15, 7, 7]]);
  });

  it('maps replacement hunks to corresponding old and new lines', () => {
    const changes = gitHunksToChanges(
      'before\nold text\nend\n',
      'before\nnew text\nend\n',
      [{ old_start: 2, old_lines: 1, new_start: 2, new_lines: 1 }],
    );
    expect(changes.map(({ fromA, toA, fromB, toB }) => [fromA, toA, fromB, toB]))
      .toEqual([[7, 10, 7, 10]]);
  });

  it('highlights only one changed line in a ten-line file', () => {
    const oldContent = Array.from({ length: 10 }, (_, index) => `line ${index + 1}`).join('\n');
    const newLines = Array.from({ length: 10 }, (_, index) => `line ${index + 1}`);
    newLines[4] = 'changed line five';
    const newContent = newLines.join('\n');
    const changes = gitHunksToChanges(
      oldContent,
      newContent,
      [{ old_start: 5, old_lines: 1, new_start: 5, new_lines: 1 }],
    );

    expect(changes.length).toBeGreaterThan(0);
    const oldLineStart = oldContent.indexOf('line 5');
    const newLineStart = newContent.indexOf('changed line five');
    const oldLineEnd = oldContent.indexOf('\n', oldLineStart);
    const newLineEnd = newContent.indexOf('\n', newLineStart);
    expect(changes.every(change =>
      change.fromA >= oldLineStart &&
      change.toA <= oldLineEnd &&
      change.fromB >= newLineStart &&
      change.toB <= newLineEnd
    )).toBe(true);
    expect(oldContent.split('\n').filter((_, index) => index !== 4))
      .toEqual(newContent.split('\n').filter((_, index) => index !== 4));

    const chunks = buildGitChunks(oldContent, newContent, [
      { old_start: 5, old_lines: 1, new_start: 5, new_lines: 1 },
    ]);
    expect(chunkLines(chunks, oldContent, newContent)).toEqual([[5, 5, 5, 5]]);
  });

  it('maps Git hunk line ranges correctly for CRLF and Unicode content', () => {
    const oldContent = 'normal\r\n✨ old\r\nnormal\r\n';
    const newContent = 'normal\r\n✨ new\r\nnormal\r\n';
    const changes = gitHunksToChanges(
      oldContent,
      newContent,
      [{ old_start: 2, old_lines: 1, new_start: 2, new_lines: 1 }],
    );

    expect(changes).toHaveLength(1);
    const [change] = changes;
    expect(oldContent.slice(change.fromA, change.toA)).toBe('old');
    expect(newContent.slice(change.fromB, change.toB)).toBe('new');
  });

  it('aligns an inserted line without marking following unchanged lines', () => {
    const oldContent = 'first\nsecond\nthird';
    const newContent = 'first\nadded\nsecond\nthird';
    const chunks = buildGitChunks(oldContent, newContent, [
      { old_start: 1, old_lines: 0, new_start: 2, new_lines: 1 },
    ]);

    expect(chunkLines(chunks, oldContent, newContent)).toEqual([[2, 2, 2, 2]]);
  });

  it('aligns a removed line without marking following unchanged lines', () => {
    const oldContent = 'first\nremoved\nsecond\nthird';
    const newContent = 'first\nsecond\nthird';
    const chunks = buildGitChunks(oldContent, newContent, [
      { old_start: 2, old_lines: 1, new_start: 1, new_lines: 0 },
    ]);

    expect(chunkLines(chunks, oldContent, newContent)).toEqual([[2, 2, 2, 2]]);
  });

  it('keeps multiple distant changes in separate regions', () => {
    const oldContent = 'a\nb\nc\nd\ne\nf\ng';
    const newContent = 'a\nB\nc\nd\ne\nF\ng';
    const chunks = buildGitChunks(oldContent, newContent, [
      { old_start: 2, old_lines: 1, new_start: 2, new_lines: 1 },
      { old_start: 6, old_lines: 1, new_start: 6, new_lines: 1 },
    ]);

    expect(chunkLines(chunks, oldContent, newContent)).toEqual([
      [2, 2, 2, 2],
      [6, 6, 6, 6],
    ]);
  });

  it('handles empty files and trailing-newline-only changes', () => {
    const addedFile = buildGitChunks('', 'new file\n', [
      { old_start: 0, old_lines: 0, new_start: 1, new_lines: 1 },
    ]);
    expect(addedFile).toHaveLength(1);

    const oldContent = 'line';
    const newContent = 'line\n';
    const newlineChange = gitHunksToChanges(oldContent, newContent, [
      { old_start: 1, old_lines: 1, new_start: 1, new_lines: 1 },
    ]);
    expect(newlineChange.map(change => [
      oldContent.slice(change.fromA, change.toA),
      newContent.slice(change.fromB, change.toB),
    ])).toEqual([['', '\n']]);
  });

  it('keeps a single change precise in a large file', () => {
    const oldLines = Array.from({ length: 20_000 }, (_, index) => `line ${index + 1}`);
    const newLines = oldLines.slice();
    newLines[9_999] = 'changed line 10000';
    const oldContent = oldLines.join('\n');
    const newContent = newLines.join('\n');
    const chunks = buildGitChunks(oldContent, newContent, [
      { old_start: 10_000, old_lines: 1, new_start: 10_000, new_lines: 1 },
    ]);

    expect(chunkLines(chunks, oldContent, newContent)).toEqual([[10_000, 10_000, 10_000, 10_000]]);
  });

  it('bounds word diff work for extremely long changed lines', () => {
    const oldContent = `${'a'.repeat(20_000)}x`;
    const newContent = `${'a'.repeat(20_000)}y`;
    const changes = gitHunksToChanges(oldContent, newContent, [
      { old_start: 1, old_lines: 1, new_start: 1, new_lines: 1 },
    ]);

    expect(changes).toHaveLength(1);
    expect(oldContent.slice(changes[0].fromA, changes[0].toA)).toBe(oldContent);
    expect(newContent.slice(changes[0].fromB, changes[0].toB)).toBe(newContent);
  });

  it('highlights only changed number and string text', () => {
    const cases = [
      { old: 'const count = 10;', next: 'const count = 20;', removed: '10', added: '20' },
      { old: 'const message = "hello";', next: 'const message = "hello world";', removed: '', added: ' world' },
    ];
    for (const { old, next, removed, added } of cases) {
      const changes = gitHunksToChanges(old, next, [
        { old_start: 1, old_lines: 1, new_start: 1, new_lines: 1 },
      ]);
      expect(changes.map(change => old.slice(change.fromA, change.toA)).join('')).toBe(removed);
      expect(changes.map(change => next.slice(change.fromB, change.toB)).join('')).toBe(added);
    }
  });
});
