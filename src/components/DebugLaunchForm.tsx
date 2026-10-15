import { useState, useEffect } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { useDebugContext } from '../context/DebugContext';
import { readDir } from '../lib/fs';
import type { DapAdapterType, DapLaunchConfig } from '../lib/dap';
import type { DebugLastConfig } from '../lib/settings';

const LS_KEY = 'r0-debug-last-config';

function loadSaved(): DebugLastConfig | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveLast(cfg: DebugLastConfig) {
  localStorage.setItem(LS_KEY, JSON.stringify(cfg));
}

const FIELD_STYLE: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  padding: '4px 7px',
  background: 'var(--r0-bg-input)',
  border: '1px solid var(--r0-border-default)',
  borderRadius: 5, outline: 'none',
  color: 'var(--r0-fg-default)',
  fontSize: '11px',
  fontFamily: 'var(--font-mono)',
};

const LABEL_STYLE: React.CSSProperties = {
  fontSize: '10px', fontWeight: 600, letterSpacing: '0.05em',
  color: 'var(--r0-fg-subtle)', textTransform: 'uppercase',
  display: 'block', marginBottom: 3,
};

interface FieldProps { label: string; children: React.ReactNode }
function Field({ label, children }: FieldProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <label style={LABEL_STYLE}>{label}</label>
      {children}
    </div>
  );
}

export default function DebugLaunchForm() {
  const { folderPath } = useWorkspace();
  const { startSession } = useDebugContext();

  const saved = loadSaved();
  const [adapter, setAdapter]       = useState<DapAdapterType>(saved?.adapter as DapAdapterType ?? 'codelldb');
  const [adapterPath, setAdapterPath] = useState(saved?.adapterPath ?? '');
  const [program, setProgram]       = useState(saved?.program ?? '');
  const [args, setArgs]             = useState(saved?.args ?? '');
  const [cwd, setCwd]               = useState(saved?.cwd ?? folderPath ?? '');
  const [stopOnEntry, setStopOnEntry] = useState(saved?.stopOnEntry ?? false);
  const [launching, setLaunching]   = useState(false);

  // Auto-detect adapter + program from project files
  useEffect(() => {
    if (!folderPath || saved) return;
    readDir(folderPath).then(entries => {
      const names = entries.map(e => e.name.toLowerCase());
      if (names.includes('cargo.toml')) {
        setAdapter('codelldb');
        const projName = folderPath.split(/[\\/]/).filter(Boolean).pop() ?? 'app';
        setProgram(`${folderPath}\\target\\debug\\${projName}.exe`);
      } else if (names.some(n => n.endsWith('.py') || n === 'requirements.txt')) {
        setAdapter('debugpy');
        setProgram(`${folderPath}\\main.py`);
      }
      setCwd(folderPath);
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folderPath]);

  async function handleLaunch() {
    if (!program.trim()) return;
    const cfg: DebugLastConfig = { adapter, adapterPath, program, args, cwd, stopOnEntry };
    saveLast(cfg);

    const bpMap = new Map<string, { line: number }[]>();
    const launchConfig: DapLaunchConfig = {
      adapter,
      adapterPath: adapterPath.trim() || undefined,
      program: program.trim(),
      args: args.trim() ? args.trim().split(/\s+/) : [],
      cwd: cwd.trim() || (folderPath ?? undefined),
      stopOnEntry,
      sourceBreakpoints: bpMap,
    };

    setLaunching(true);
    try {
      await startSession(launchConfig);
    } finally {
      setLaunching(false);
    }
  }

  return (
    <div style={{ padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Field label="Adapter">
        <select
          value={adapter}
          onChange={e => setAdapter(e.target.value as DapAdapterType)}
          style={{ ...FIELD_STYLE, cursor: 'pointer' }}
        >
          <option value="codelldb">codelldb (Rust / C++)</option>
          <option value="debugpy">debugpy (Python)</option>
        </select>
      </Field>

      <Field label="Adapter path">
        <input
          type="text"
          value={adapterPath}
          onChange={e => setAdapterPath(e.target.value)}
          placeholder={adapter === 'codelldb' ? 'codelldb.exe' : 'python (on PATH)'}
          style={FIELD_STYLE}
          onFocus={e => { (e.target as HTMLElement).style.borderColor = 'var(--r0-accent-blue)'; }}
          onBlur={e => { (e.target as HTMLElement).style.borderColor = 'var(--r0-border-default)'; }}
        />
      </Field>

      <Field label="Program">
        <input
          type="text"
          value={program}
          onChange={e => setProgram(e.target.value)}
          placeholder="Path to executable or script"
          style={FIELD_STYLE}
          onFocus={e => { (e.target as HTMLElement).style.borderColor = 'var(--r0-accent-blue)'; }}
          onBlur={e => { (e.target as HTMLElement).style.borderColor = 'var(--r0-border-default)'; }}
        />
      </Field>

      <Field label="Args">
        <input
          type="text"
          value={args}
          onChange={e => setArgs(e.target.value)}
          placeholder="Space-separated arguments"
          style={FIELD_STYLE}
          onFocus={e => { (e.target as HTMLElement).style.borderColor = 'var(--r0-accent-blue)'; }}
          onBlur={e => { (e.target as HTMLElement).style.borderColor = 'var(--r0-border-default)'; }}
        />
      </Field>

      <Field label="Working dir">
        <input
          type="text"
          value={cwd}
          onChange={e => setCwd(e.target.value)}
          placeholder={folderPath ?? ''}
          style={FIELD_STYLE}
          onFocus={e => { (e.target as HTMLElement).style.borderColor = 'var(--r0-accent-blue)'; }}
          onBlur={e => { (e.target as HTMLElement).style.borderColor = 'var(--r0-border-default)'; }}
        />
      </Field>

      <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: '11px', color: 'var(--r0-fg-muted)' }}>
        <input
          type="checkbox"
          checked={stopOnEntry}
          onChange={e => setStopOnEntry(e.target.checked)}
          style={{ cursor: 'pointer' }}
        />
        Stop on entry
      </label>

      <button
        onClick={handleLaunch}
        disabled={launching || !program.trim()}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          padding: '6px 12px', borderRadius: 6, border: 'none',
          backgroundColor: launching || !program.trim()
            ? 'var(--r0-bg-active)'
            : 'var(--r0-accent-blue)',
          color: launching || !program.trim() ? 'var(--r0-fg-subtle)' : 'var(--r0-bg-base)',
          cursor: launching || !program.trim() ? 'not-allowed' : 'pointer',
          fontSize: '12px', fontWeight: 600, fontFamily: 'var(--font-sans)',
          transition: 'background 0.15s',
          marginTop: 2,
        }}
      >
        {launching ? 'Starting…' : '▶ Start Debugging'}
      </button>
    </div>
  );
}
