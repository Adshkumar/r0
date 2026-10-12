import { useEffect, useRef, useState } from 'react';
import { MergeView } from '@codemirror/merge';
import { EditorView, lineNumbers } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { syntaxHighlighting } from '@codemirror/language';
import { GitCompare } from 'lucide-react';
import { getGitFileDiff } from '../../lib/git';
import { r0BaseTheme, r0Highlight } from './Editor';
import { getLanguageExtension } from './languageSupport';
import type { Tab } from './TabBar';

const gitDiffTheme = EditorView.theme({
  '&.cm-merge-a .cm-changedLine': {
    backgroundColor: 'color-mix(in srgb, var(--r0-semantic-error) 14%, transparent)',
  },
  '&.cm-merge-a .cm-changedLineGutter, &.cm-merge-a .cm-deletedLineGutter': {
    backgroundColor: 'color-mix(in srgb, var(--r0-semantic-error) 32%, transparent)',
  },
  '&.cm-merge-b .cm-changedLine': {
    backgroundColor: 'color-mix(in srgb, var(--r0-semantic-success) 14%, transparent)',
  },
  '&.cm-merge-b .cm-changedLineGutter': {
    backgroundColor: 'color-mix(in srgb, var(--r0-semantic-success) 32%, transparent)',
  },
  '&.cm-merge-a .cm-changedText': {
    backgroundColor: 'color-mix(in srgb, var(--r0-semantic-error) 35%, transparent)',
  },
  '&.cm-merge-b .cm-changedText': {
    backgroundColor: 'color-mix(in srgb, var(--r0-semantic-success) 35%, transparent)',
  },
});

interface Props {
  rootPath: string;
  tab: Tab;
}

export default function GitDiffPane({ rootPath, tab }: Props) {
  const mergeHost = useRef<HTMLDivElement>(null);
  const diff = tab.gitDiff;
  const fileName = diff?.newFilePath.split(/[\\/]/).filter(Boolean).pop() ?? tab.name;
  const requestKey = `${rootPath}:${tab.path}`;
  const [result, setResult] = useState<{
    key: string;
    content: { old: string; current: string } | null;
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
        if (current) setResult({ key: requestKey, content: { old: result.old_content, current: result.new_content }, error: null });
      })
      .catch(reason => {
        if (current) setResult({ key: requestKey, content: null, error: String(reason) });
      });
    return () => { current = false; };
  }, [rootPath, tab.path, diff, requestKey]);

  useEffect(() => {
    if (!content || !mergeHost.current || !diff) return;
    const extensions = [
      lineNumbers(),
      syntaxHighlighting(r0Highlight),
      getLanguageExtension(diff.newFilePath),
      EditorState.readOnly.of(true),
      EditorView.editable.of(false),
      r0BaseTheme,
      gitDiffTheme,
    ];
    const merge = new MergeView({
      a: { doc: content.old, extensions },
      b: { doc: content.current, extensions },
      parent: mergeHost.current,
      highlightChanges: true,
      gutter: true,
      collapseUnchanged: { margin: 3, minSize: 4 },
    });
    merge.dom.style.height = '100%';
    merge.dom.style.overflow = 'auto';
    merge.dom.style.backgroundColor = 'var(--r0-bg-editor)';
    return () => merge.destroy();
  }, [content, diff]);

  if (!diff) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderBottom: '1px solid var(--r0-border-default)', background: 'var(--r0-bg-panel)', flexShrink: 0 }}>
        <GitCompare size={14} color="var(--r0-accent-blue)" />
        <span style={{ minWidth: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, color: 'var(--r0-fg-default)' }}>{fileName}</span>
        <span style={{ color: 'var(--r0-fg-subtle)', fontSize: 10, flexShrink: 0 }}>{loading ? 'Loading diff…' : `${diff.oldLabel}  ↔  ${diff.newLabel}`}</span>
      </div>
      {error ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <p style={{ maxWidth: 500, color: 'var(--r0-fg-muted)', textAlign: 'center', fontSize: 12, lineHeight: 1.6 }}>{error}</p>
        </div>
      ) : loading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--r0-fg-subtle)', fontSize: 12 }}>Loading historical file contents…</div>
      ) : (
        <div ref={mergeHost} style={{ flex: 1, minHeight: 0, overflow: 'hidden', background: 'var(--r0-bg-editor)' }} />
      )}
    </div>
  );
}
