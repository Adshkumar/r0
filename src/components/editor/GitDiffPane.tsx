import { memo, useEffect, useRef, useState } from 'react';
import { MergeView } from '@codemirror/merge';
import { EditorView, lineNumbers } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { syntaxHighlighting } from '@codemirror/language';
import { GitCompare } from 'lucide-react';
import { getGitCommitDetails, getGitFileDiff } from '../../lib/git';
import type { GitCommitDetails, GitDiffHunk } from '../../lib/git';
import { gitHunksToChanges } from '../../lib/gitDiffRanges';
import { r0BaseTheme, r0Highlight } from './Editor';
import { getLanguageExtension } from './languageSupport';
import type { Tab } from './TabBar';

const gitDiffTheme = EditorView.theme({
  '&.cm-merge-a .cm-changedLine': {
    backgroundColor: 'var(--r0-git-diff-removed-line)',
  },
  '&.cm-merge-a .cm-changedLineGutter, &.cm-merge-a .cm-deletedLineGutter': {
    backgroundColor: 'var(--r0-git-diff-removed-line)',
  },
  '&.cm-merge-b .cm-changedLine': {
    backgroundColor: 'var(--r0-git-diff-added-line)',
  },
  '&.cm-merge-b .cm-changedLineGutter': {
    backgroundColor: 'var(--r0-git-diff-added-line)',
  },
  '&.cm-merge-a .cm-changedText': {
    backgroundColor: 'var(--r0-git-diff-removed-text)',
  },
  '&.cm-merge-b .cm-changedText': {
    backgroundColor: 'var(--r0-git-diff-added-text)',
  },
});

interface Props {
  rootPath: string;
  tab: Tab;
  onOpenCommit: (hash: string) => void;
}

export default memo(function GitDiffPane({ rootPath, tab, onOpenCommit }: Props) {
  const mergeHost = useRef<HTMLDivElement>(null);
  const [retryCount, setRetryCount] = useState(0);
  const diff = tab.gitDiff;
  const fileName = diff?.newFilePath.split(/[\\/]/).filter(Boolean).pop() ?? tab.name;
  const requestKey = `${rootPath}:${tab.path}:${retryCount}`;
  const [result, setResult] = useState<{
    key: string;
    content: { old: string; current: string; hunks: GitDiffHunk[] | null } | null;
    error: string | null;
  } | null>(null);
  const [commitDetails, setCommitDetails] = useState<{
    key: string;
    old: GitCommitDetails | null;
    current: GitCommitDetails | null;
    error: string | null;
  } | null>(null);
  const currentResult = result?.key === requestKey ? result : null;
  const content = currentResult?.content ?? null;
  const error = currentResult?.error ?? null;
  const loading = currentResult === null;

  useEffect(() => {
    if (!diff) return;
    let current = true;
    getGitFileDiff({
      path: rootPath,
      oldRevision: diff.oldRevision,
      newRevision: diff.newRevision,
      oldFilePath: diff.oldFilePath,
      newFilePath: diff.newFilePath,
      oldIsEmpty: diff.oldIsEmpty,
      newIsEmpty: diff.newIsEmpty,
      newIsWorkingTree: diff.newIsWorkingTree,
    })
      .then(result => {
        if (current) setResult({ key: requestKey, content: { old: result.old_content, current: result.new_content, hunks: result.hunks }, error: null });
      })
      .catch(reason => {
        if (current) setResult({ key: requestKey, content: null, error: String(reason) });
      });
    return () => { current = false; };
  }, [rootPath, tab.path, diff, requestKey]);

  const commitDetailsKey = `${rootPath}:${diff?.oldRevision ?? ''}:${diff?.newRevision ?? ''}`;
  useEffect(() => {
    if (!diff) return;
    let current = true;
    const isCommitHash = (value: string | null): value is string => !!value && /^[0-9a-f]{40,64}$/i.test(value);
    const oldDetails = isCommitHash(diff.oldRevision)
      ? getGitCommitDetails(rootPath, diff.oldRevision, null)
      : Promise.resolve(null);
    const newDetails = isCommitHash(diff.newRevision)
      ? getGitCommitDetails(rootPath, diff.newRevision, null)
      : Promise.resolve(null);
    Promise.allSettled([oldDetails, newDetails]).then(([old, next]) => {
      if (!current) return;
      const error = [old, next].find(result => result.status === 'rejected');
      setCommitDetails({
        key: commitDetailsKey,
        old: old.status === 'fulfilled' ? old.value : null,
        current: next.status === 'fulfilled' ? next.value : null,
        error: error?.status === 'rejected' ? String(error.reason) : null,
      });
    });
    return () => { current = false; };
  }, [rootPath, diff, commitDetailsKey]);

  const currentCommitDetails = commitDetails?.key === commitDetailsKey ? commitDetails : null;

  useEffect(() => {
    if (!content || !mergeHost.current || !diff) return;
    const sharedExtensions = [
      lineNumbers(),
      syntaxHighlighting(r0Highlight),
      EditorState.readOnly.of(true),
      EditorView.editable.of(false),
      r0BaseTheme,
      gitDiffTheme,
    ];
    const merge = new MergeView({
      a: { doc: content.old, extensions: [...sharedExtensions, getLanguageExtension(diff.oldFilePath)] },
      b: { doc: content.current, extensions: [...sharedExtensions, getLanguageExtension(diff.newFilePath)] },
      parent: mergeHost.current,
      highlightChanges: true,
      gutter: true,
      collapseUnchanged: { margin: 3, minSize: 4 },
      ...(content.hunks !== null && {
        diffConfig: {
          override: () => gitHunksToChanges(content.old, content.current, content.hunks ?? []),
        },
      }),
    });
    merge.dom.style.height = '100%';
    merge.dom.style.overflow = 'auto';
    merge.dom.style.backgroundColor = 'var(--r0-bg-editor)';
    merge.dom.classList.add('r0-git-diff-view');
    return () => merge.destroy();
  }, [content, diff]);

  if (!diff) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderBottom: '1px solid var(--r0-border-default)', background: 'var(--r0-bg-panel)', flexShrink: 0 }}>
        <GitCompare size={14} color="var(--r0-accent-blue)" />
        <span style={{ minWidth: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, color: 'var(--r0-fg-default)' }}>
          {diff.oldFilePath !== diff.newFilePath
            ? `${diff.oldFilePath} → ${diff.newFilePath}`
            : fileName}
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', borderBottom: '1px solid var(--r0-border-default)', background: 'var(--r0-bg-sidebar)', flexShrink: 0 }}>
        <div style={{ minWidth: 0, padding: '5px 12px', borderRight: '1px solid var(--r0-border-default)', color: 'var(--r0-fg-subtle)', fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          <span style={{ color: 'var(--r0-fg-muted)' }}>Original</span>
          {' · '}
          {diff.oldRevision && /^[0-9a-f]{40,64}$/i.test(diff.oldRevision) ? (
            <button
              type="button"
              onClick={() => {
                if (diff.oldRevision) onOpenCommit(diff.oldRevision);
              }}
              title={[
                diff.oldRevision,
                currentCommitDetails?.old?.message,
                currentCommitDetails?.old ? `${currentCommitDetails.old.author} · ${new Date(currentCommitDetails.old.author_time * 1000).toLocaleString()}` : null,
                currentCommitDetails?.error,
              ].filter(Boolean).join('\n')}
              style={{ border: 0, padding: 0, background: 'none', color: 'var(--r0-accent-blue)', font: 'inherit', cursor: 'pointer' }}
            >
              {diff.oldRevision.slice(0, 7)}
            </button>
          ) : diff.oldIsEmpty ? 'Empty tree' : diff.oldLabel}
          {' · '}{diff.oldFilePath}
        </div>
        <div style={{ minWidth: 0, padding: '5px 12px', color: 'var(--r0-fg-subtle)', fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          <span style={{ color: 'var(--r0-fg-muted)' }}>Modified</span>
          {' · '}
          {diff.newRevision && /^[0-9a-f]{40,64}$/i.test(diff.newRevision) ? (
            <button
              type="button"
              onClick={() => {
                if (diff.newRevision) onOpenCommit(diff.newRevision);
              }}
              title={[
                diff.newRevision,
                currentCommitDetails?.current?.message,
                currentCommitDetails?.current ? `${currentCommitDetails.current.author} · ${new Date(currentCommitDetails.current.author_time * 1000).toLocaleString()}` : null,
                currentCommitDetails?.error,
              ].filter(Boolean).join('\n')}
              style={{ border: 0, padding: 0, background: 'none', color: 'var(--r0-accent-blue)', font: 'inherit', cursor: 'pointer' }}
            >
              {diff.newRevision.slice(0, 7)}
            </button>
          ) : diff.newLabel}
          {' · '}{diff.newFilePath}
        </div>
      </div>
      {error ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ maxWidth: 500, textAlign: 'center' }}>
            <p style={{ color: 'var(--r0-fg-muted)', fontSize: 12, lineHeight: 1.6 }}>{error}</p>
            <button onClick={() => setRetryCount(count => count + 1)} style={{ marginTop: 8, padding: '5px 10px', border: '1px solid var(--r0-border-default)', borderRadius: 4, background: 'var(--r0-bg-panel)', color: 'var(--r0-fg-default)', cursor: 'pointer', fontSize: 11 }}>Retry diff</button>
          </div>
        </div>
      ) : loading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--r0-fg-subtle)', fontSize: 12 }}>Loading historical file contents…</div>
      ) : (
        <div style={{ position: 'relative', flex: 1, minHeight: 0, overflow: 'hidden', background: 'var(--r0-bg-editor)' }}>
          <div ref={mergeHost} style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: 'var(--r0-bg-editor)' }} />
          {diff.oldIsEmpty && (
            <div style={{
              position: 'absolute',
              inset: '0 50% 0 0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 20,
              boxSizing: 'border-box',
              color: 'var(--r0-fg-subtle)',
              fontSize: 11,
              textAlign: 'center',
              pointerEvents: 'none',
            }}>
              No previous file — this commit adds it.
            </div>
          )}
          {diff.newIsEmpty && (
            <div style={{
              position: 'absolute',
              inset: '0 0 0 50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 20,
              boxSizing: 'border-box',
              color: 'var(--r0-fg-subtle)',
              fontSize: 11,
              textAlign: 'center',
              pointerEvents: 'none',
            }}>
              This file is deleted in this comparison.
            </div>
          )}
        </div>
      )}
    </div>
  );
});
