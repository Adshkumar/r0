import { describe, expect, it } from 'vitest';
import { gitHunksToChanges } from '../gitDiffRanges';

describe('git hunk range conversion', () => {
  it('keeps identical revisions change-free', () => {
    expect(gitHunksToChanges('same\n', 'same\n', [])).toEqual([]);
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
});
