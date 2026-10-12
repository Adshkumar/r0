import { memo, useEffect, useState } from 'react';
import { GitBranch, GitCommitHorizontal, GitCompare, Copy, FileText } from 'lucide-react';
import {
  getGitCommitDetails,
  type GitChangedFile,
  type GitCommitDetails,
} from '../../lib/git';

interface Props {
  rootPath: string;
  hash: string;
  onOpenDiff: (rootPath: string, file: GitChangedFile, details: GitCommitDetails) => void;
}

function localDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString();
}

export default memo(function GitCommitDetailsPane({ rootPath, hash, onOpenDiff }: Props) {
  const [parent, setParent] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [result, setResult] = useState<{
    key: string;
    details: GitCommitDetails | null;
    error: string | null;
  } | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);
  const requestKey = `${rootPath}:${hash}:${parent ?? ''}:${retryCount}`;
  const currentResult = result?.key === requestKey ? result : null;
  const details = currentResult?.details ?? null;
  const error = currentResult?.error ?? null;
  const loading = currentResult === null;

  useEffect(() => {
    let current = true;
    getGitCommitDetails(rootPath, hash, parent)
      .then(details => {
        if (current) setResult({ key: requestKey, details, error: null });
      })
      .catch(reason => {
        if (current) setResult({ key: requestKey, details: null, error: String(reason) });
      });
    return () => { current = false; };
  }, [rootPath, hash, parent, requestKey]);

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopyError(null);
    } catch {
      setCopyError('Could not copy to the clipboard.');
    }
  }

  const secondary: React.CSSProperties = { color: 'var(--r0-fg-subtle)', fontSize: 11 };

  if (loading) {
    return <div style={{ padding: 20, color: 'var(--r0-fg-subtle)', fontSize: 12 }}>Loading commit details…</div>;
  }
  if (error && !details) {
    return (
      <div style={{ padding: 20, color: 'var(--r0-semantic-error)', fontSize: 12 }}>
        <p>{error}</p>
        <button onClick={() => setRetryCount(count => count + 1)} style={{ padding: '5px 10px', border: '1px solid var(--r0-border-default)', borderRadius: 4, background: 'var(--r0-bg-panel)', color: 'var(--r0-fg-default)', cursor: 'pointer', fontSize: 11 }}>Retry commit details</button>
      </div>
    );
  });
  if (!details) return null;

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: '20px 24px', boxSizing: 'border-box', color: 'var(--r0-fg-default)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <GitCommitHorizontal size={17} color="var(--r0-accent-blue)" />
        <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Commit details</h2>
        <button
          onClick={() => void copy(details.hash)}
          title="Copy commit hash"
          style={{ marginLeft: 'auto', border: 0, background: 'transparent', color: 'var(--r0-fg-muted)', cursor: 'pointer', display: 'flex', gap: 5, alignItems: 'center', fontSize: 11 }}
        >
          <Copy size={12} /> Copy hash
        </button>
        <button
          onClick={() => void copy(details.message)}
          title="Copy commit message"
          style={{ border: 0, background: 'transparent', color: 'var(--r0-fg-muted)', cursor: 'pointer', display: 'flex', gap: 5, alignItems: 'center', fontSize: 11 }}
        >
          <Copy size={12} /> Copy message
        </button>
      </div>

      <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', margin: '0 0 14px', fontFamily: 'var(--font-sans)', fontSize: 15, lineHeight: 1.5 }}>
        {details.message.trim() || '(no commit message)'}
      </pre>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px 16px', ...secondary, marginBottom: 18 }}>
        <span style={{ fontFamily: 'var(--font-mono)' }}>{details.hash}</span>
        <span>{details.author} &lt;{details.author_email}&gt; · authored {localDate(details.author_time)}</span>
        <span>{details.committer} &lt;{details.committer_email}&gt; · committed {localDate(details.committer_time)}</span>
      </div>

      {details.refs.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
          {details.refs.map(ref => (
            <span key={ref} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: '1px solid var(--r0-border-default)', borderRadius: 4, padding: '2px 6px', fontSize: 10, color: 'var(--r0-fg-muted)' }}>
              <GitBranch size={10} /> {ref}
            </span>
          ))}
        </div>
      )}

      {details.parents.length > 1 && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, ...secondary }}>
          Compare with parent
          <select
            value={details.comparison_parent ?? ''}
            onChange={e => setParent(e.target.value || null)}
            style={{ background: 'var(--r0-bg-base)', color: 'var(--r0-fg-default)', border: '1px solid var(--r0-border-default)', borderRadius: 4, padding: '3px 6px', fontSize: 11 }}
          >
            {details.parents.map((p, index) => <option key={p} value={p}>Parent {index + 1} · {p.slice(0, 10)}</option>)}
          </select>
        </label>
      )}

      <div style={{ borderTop: '1px solid var(--r0-border-default)', paddingTop: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, marginBottom: 7 }}>
          <FileText size={13} /> Changed files ({details.files.length})
          {details.comparison_parent && <span style={{ ...secondary, fontWeight: 400 }}>against {details.comparison_parent.slice(0, 10)}</span>}
          {!details.comparison_parent && <span style={{ ...secondary, fontWeight: 400 }}>root commit · empty tree</span>}
        </div>
        {details.files.length === 0 ? (
          <p style={secondary}>No file changes in this comparison.</p>
        ) : (
          <div>
            {details.files.map((file, index) => (
              <button
                key={`${file.path}:${index}`}
                onClick={() => onOpenDiff(rootPath, file, details)}
                title={`${file.status}: ${file.old_path ? `${file.old_path} → ` : ''}${file.path}`}
                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', padding: '6px 8px', border: 0, borderRadius: 4, background: 'transparent', color: 'var(--r0-fg-default)', cursor: 'pointer' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--r0-bg-hover)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              >
                <GitCompare size={12} style={{ flexShrink: 0, color: file.status === 'added' ? 'var(--r0-git-added)' : file.status === 'deleted' ? 'var(--r0-git-deleted)' : 'var(--r0-fg-muted)' }} />
                <span style={{ minWidth: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11 }}>
                  {file.old_path ? `${file.old_path} → ` : ''}{file.path}
                </span>
                <span style={{ ...secondary, flexShrink: 0 }}>{file.status}</span>
                {file.additions !== null && <span style={{ color: 'var(--r0-git-added)', fontFamily: 'var(--font-mono)', fontSize: 10 }}>+{file.additions}</span>}
                {file.deletions !== null && <span style={{ color: 'var(--r0-git-deleted)', fontFamily: 'var(--font-mono)', fontSize: 10 }}>−{file.deletions}</span>}
                {file.binary && <span style={secondary}>binary</span>}
              </button>
            ))}
          </div>
        )}
      </div>
      {(copyError || error) && <p style={{ color: 'var(--r0-semantic-error)', fontSize: 11 }}>{copyError ?? error}</p>}
    </div>
  );
}
