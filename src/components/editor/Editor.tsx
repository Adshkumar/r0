/* eslint-disable react-refresh/only-export-components -- this module exports helper hooks/utilities alongside the editor component */
import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { createPortal } from 'react-dom';
import { canFormat } from '../../lib/formatting';
import {
  EditorView, keymap, lineNumbers,
  highlightActiveLineGutter, highlightActiveLine, drawSelection,
} from '@codemirror/view';
import { EditorState, Compartment } from '@codemirror/state';
import { undo as cmUndo, redo as cmRedo, selectAll as cmSelectAll, defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import {
  syntaxHighlighting, HighlightStyle,
  bracketMatching, indentOnInput,
} from '@codemirror/language';
import { linter, lintGutter } from '@codemirror/lint';
import { openSearchPanel, search, searchKeymap } from '@codemirror/search';
import { tags as t } from '@lezer/highlight';
import { unifiedMergeView } from '@codemirror/merge';
import { createHunkControls } from '../../lib/hunkControls';
import { insertNewlineInEmptyPair } from '../../lib/editorCommands';
import { getParserDiagnostics } from '../../lib/editorDiagnostics';
import { indentationGuides } from '../../lib/indentationGuides';
import { getLanguageExtension, languageLabel } from './languageSupport';
import { createLspExtension } from '../../lib/lspCm6';
import { getLspLanguage } from '../../lib/lsp';
import { useToast } from '../ui/Toast';
import { createAiAutocompleteExtension, type AiCompletionFn } from '../../lib/aiAutocomplete';
import { createLocalCompletions, getSuggestionLanguage } from '../../lib/localCompletions';
import { formatSource } from '../../lib/formatting';
import { formatWithLanguageServer, supportsLspFormatting } from '../../lib/lspCm6';
import { getEffectiveKey } from '../../lib/keybindings';
import { useEditorSuggestionSettings, useEditorSuggestionSettingsLoaded } from '../../lib/editorSuggestions';
import {
  createDapExtension,
  addBreakpointEffect,
  clearBreakpointsEffect,
  setPausedLineEffect,
} from '../../lib/dapCm6';

// ── Syntax token colors — all via CSS variables ────────────────────────────────

export const r0Highlight = HighlightStyle.define([
  { tag: t.comment,                                    color: 'var(--r0-syntax-comment)', fontStyle: 'italic' },
  { tag: t.lineComment,                                color: 'var(--r0-syntax-comment)', fontStyle: 'italic' },
  { tag: t.blockComment,                               color: 'var(--r0-syntax-comment)', fontStyle: 'italic' },
  { tag: t.docComment,                                 color: 'var(--r0-syntax-comment)', fontStyle: 'italic' },
  { tag: t.keyword,                                    color: 'var(--r0-syntax-keyword)' },
  { tag: t.controlKeyword,                             color: 'var(--r0-syntax-keyword)' },
  { tag: t.definitionKeyword,                          color: 'var(--r0-syntax-keyword)' },
  { tag: t.moduleKeyword,                              color: 'var(--r0-syntax-keyword)' },
  { tag: t.operatorKeyword,                            color: 'var(--r0-syntax-keyword)' },
  { tag: [t.string, t.special(t.string)],              color: 'var(--r0-syntax-string)' },
  { tag: t.docString,                                  color: 'var(--r0-syntax-string)' },
  { tag: [t.regexp, t.escape],                         color: 'var(--r0-syntax-string)' },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: 'var(--r0-syntax-function)' },
  { tag: t.definition(t.function(t.variableName)),     color: 'var(--r0-syntax-function)' },
  { tag: t.definition(t.function(t.propertyName)),      color: 'var(--r0-syntax-function)' },
  { tag: t.definition(t.variableName),                 color: 'var(--r0-syntax-variable)' },
  { tag: t.local(t.variableName),                      color: 'var(--r0-syntax-variable)' },
  { tag: t.special(t.variableName),                    color: 'var(--r0-syntax-constant)' },
  { tag: t.variableName,                               color: 'var(--r0-syntax-variable)' },
  { tag: t.propertyName,                               color: 'var(--r0-syntax-property)' },
  { tag: t.standard(t.propertyName),                    color: 'var(--r0-syntax-function)' },
  { tag: t.namespace,                                  color: 'var(--r0-syntax-module)' },
  { tag: t.standard(t.tagName),                        color: 'var(--r0-syntax-tag)' },
  { tag: t.standard(t.variableName),                   color: 'var(--r0-syntax-constant)' },
  { tag: [t.literal, t.number, t.integer, t.float],    color: 'var(--r0-syntax-constant)' },
  { tag: t.constant(t.variableName),                   color: 'var(--r0-syntax-constant)' },
  { tag: t.bool,                                       color: 'var(--r0-syntax-constant)' },
  { tag: t.null,                                       color: 'var(--r0-syntax-constant)' },
  { tag: [t.typeName, t.className, t.macroName],       color: 'var(--r0-syntax-type)' },
  { tag: t.typeOperator,                               color: 'var(--r0-syntax-type)' },
  { tag: t.operator,                                   color: 'var(--r0-syntax-operator)' },
  { tag: t.punctuation,                                color: 'var(--r0-syntax-punctuation)' },
  { tag: t.bracket,                                    color: 'var(--r0-syntax-bracket)' },
  { tag: t.attributeName,                              color: 'var(--r0-syntax-attribute)' },
  { tag: t.attributeValue,                             color: 'var(--r0-syntax-string)' },
  { tag: t.tagName,                                    color: 'var(--r0-syntax-tag)' },
  { tag: t.self,                                       color: 'var(--r0-syntax-keyword)' },
  { tag: [t.meta, t.documentMeta],                     color: 'var(--r0-syntax-comment)' },
  { tag: t.invalid,                                    color: 'var(--r0-semantic-error)', textDecoration: 'underline wavy' },
  { tag: t.strong,                                     fontWeight: 'bold' },
  { tag: t.emphasis,                                   fontStyle: 'italic' },
  { tag: t.strikethrough,                              textDecoration: 'line-through' },
  { tag: t.link,                                       color: 'var(--r0-syntax-constant)', textDecoration: 'underline' },
  { tag: t.heading,                                    color: 'var(--r0-syntax-keyword)', fontWeight: 'bold' },
]);

// ── Structural theme ───────────────────────────────────────────────────────────

export const r0BaseTheme = EditorView.theme({
  '&': {
    height: '100%',
    backgroundColor: 'transparent',
    color: 'var(--r0-fg-default)',
  },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': {
    fontFamily: 'var(--font-mono, "Geist Mono", "Fira Code", monospace)',
    fontSize: '13px',
    lineHeight: '1.65',
    overflow: 'auto',
  },
  '.cm-content': {
    padding: '8px 0',
    caretColor: 'var(--r0-editor-cursor, var(--r0-accent-blue))',
    tabSize: 4,
  },
  '.cm-gutters': {
    backgroundColor: 'transparent',
    border: 'none',
    borderRight: '1px solid var(--r0-border-default)',
    color: 'var(--r0-fg-subtle)',
    paddingRight: '0',
    userSelect: 'none',
  },
  '.cm-lineNumbers .cm-gutterElement': {
    minWidth: '3.2em',
    padding: '0 12px 0 8px',
    textAlign: 'right',
  },
  '.cm-foldGutter .cm-gutterElement': { padding: '0 4px' },
  '.cm-activeLine': { backgroundColor: 'var(--r0-bg-hover)' },
  '.cm-activeLineGutter': {
    backgroundColor: 'var(--r0-bg-hover)',
    color: 'var(--r0-fg-muted)',
  },
  '.cm-searchMatch': {
    backgroundColor: 'color-mix(in srgb, var(--r0-accent-yellow) 24%, transparent)',
    outline: '1px solid color-mix(in srgb, var(--r0-accent-yellow) 38%, transparent)',
  },
  '.cm-searchMatch-selected': {
    backgroundColor: 'color-mix(in srgb, var(--r0-accent-blue) 32%, transparent)',
    outline: '1px solid color-mix(in srgb, var(--r0-accent-blue) 62%, transparent)',
  },
  '.cm-cursor, .cm-dropCursor': {
    borderLeftColor: 'var(--r0-editor-cursor, var(--r0-accent-blue))',
    borderLeftWidth: '2px',
  },
  '&.cm-focused .cm-matchingBracket': {
    backgroundColor: 'color-mix(in srgb, var(--r0-syntax-bracket) 18%, transparent)',
    outline: '1px solid color-mix(in srgb, var(--r0-syntax-bracket) 48%, transparent)',
    borderRadius: '2px',
  },
  '.cm-nonmatchingBracket': {
    color: 'var(--r0-semantic-error)',
    backgroundColor: 'color-mix(in srgb, var(--r0-semantic-error) 12%, transparent)',
    outline: '1px solid color-mix(in srgb, var(--r0-semantic-error) 45%, transparent)',
    borderRadius: '2px',
  },
  '.cm-indent-guide': {
    backgroundImage: 'linear-gradient(to right, transparent calc(var(--r0-indent-guide-step) - 1px), color-mix(in srgb, var(--r0-fg-subtle) 28%, transparent) calc(var(--r0-indent-guide-step) - 1px), color-mix(in srgb, var(--r0-fg-subtle) 28%, transparent) var(--r0-indent-guide-step))',
    backgroundSize: 'var(--r0-indent-guide-step) 100%',
    backgroundRepeat: 'repeat-x',
  },
  '.cm-lintRange-error': {
    textDecoration: 'underline wavy var(--r0-semantic-error)',
    textUnderlineOffset: '3px',
  },
  '.cm-lintRange-warning': {
    textDecoration: 'underline wavy var(--r0-semantic-warning)',
    textUnderlineOffset: '3px',
  },
  '.cm-lintRange-info, .cm-lintRange-hint': {
    textDecoration: 'underline dotted var(--r0-semantic-info)',
    textUnderlineOffset: '3px',
  },
  '.cm-lintPoint-error::after': {
    borderBottomColor: 'var(--r0-semantic-error)',
  },
  '.cm-lintPoint-warning::after': {
    borderBottomColor: 'var(--r0-semantic-warning)',
  },
  '.cm-lintPoint-info::after, .cm-lintPoint-hint::after': {
    borderBottomColor: 'var(--r0-semantic-info)',
  },
  '.cm-tooltip-lint': {
    backgroundColor: 'var(--r0-bg-base)',
    border: '1px solid var(--r0-border-default)',
    color: 'var(--r0-fg-default)',
  },
  '.cm-tooltip': {
    backgroundColor: 'var(--r0-bg-base)',
    border: '1px solid var(--r0-border-default)',
    borderRadius: '6px',
    color: 'var(--r0-fg-default)',
  },
  '.cm-tooltip-autocomplete ul li[aria-selected]': {
    backgroundColor: 'var(--r0-bg-hover)',
  },
  '.cm-panels': { backgroundColor: 'var(--r0-bg-base)', color: 'var(--r0-fg-default)' },
  '.cm-panels.cm-panels-top': { borderBottom: '1px solid var(--r0-border-default)' },
  '.cm-panels.cm-panels-bottom': { borderTop: '1px solid var(--r0-border-default)' },
  '.cm-search': {
    display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px',
    padding: '6px 10px',
    backgroundColor: 'var(--r0-bg-base)',
  },
  '.cm-search label': { fontSize: '12px', color: 'var(--r0-fg-muted)', display: 'flex', alignItems: 'center', gap: '4px' },
  '.cm-textfield': {
    background: 'var(--r0-bg-input)',
    border: '1px solid var(--r0-border-default)',
    borderRadius: '5px',
    color: 'var(--r0-fg-default)',
    padding: '3px 7px',
    fontSize: '12px',
    fontFamily: 'var(--font-mono)',
    outline: 'none',
    minWidth: '120px',
  },
  '.cm-textfield:focus': { borderColor: 'var(--r0-accent-blue)' },
  '.cm-button': {
    background: 'var(--r0-bg-hover)',
    border: '1px solid var(--r0-border-default)',
    borderRadius: '5px',
    color: 'var(--r0-fg-default)',
    padding: '3px 10px',
    fontSize: '12px',
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
  },
  '.cm-button:hover': { background: 'var(--r0-bg-active)' },
  // ── Unified merge view (diff) ─────────────────────────────────────────────
  '.cm-deletedChunk': {
    backgroundColor: 'color-mix(in srgb, var(--r0-semantic-error) 14%, transparent)',
  },
  '.cm-deletedChunk-gutter': {
    backgroundColor: 'color-mix(in srgb, var(--r0-semantic-error) 28%, transparent)',
    borderRight: '3px solid color-mix(in srgb, var(--r0-semantic-error) 65%, transparent)',
  },
  '.cm-changedChunk': {
    backgroundColor: 'color-mix(in srgb, var(--r0-semantic-success) 13%, transparent)',
  },
  '.cm-changedChunk-gutter': {
    backgroundColor: 'color-mix(in srgb, var(--r0-semantic-success) 25%, transparent)',
    borderRight: '3px solid color-mix(in srgb, var(--r0-semantic-success) 65%, transparent)',
  },
  '.cm-insertedChunk': {
    backgroundColor: 'color-mix(in srgb, var(--r0-semantic-success) 13%, transparent)',
  },
  '.cm-insertedChunk-gutter': {
    backgroundColor: 'color-mix(in srgb, var(--r0-semantic-success) 25%, transparent)',
    borderRight: '3px solid color-mix(in srgb, var(--r0-semantic-success) 65%, transparent)',
  },
  '.cm-deletedChunkField': {
    backgroundColor: 'color-mix(in srgb, var(--r0-semantic-error) 35%, transparent)',
    borderRadius: '2px',
  },
  '.cm-changedChunkField': {
    backgroundColor: 'color-mix(in srgb, var(--r0-semantic-success) 35%, transparent)',
    borderRadius: '2px',
  },
  '.cm-collapsedLines': {
    backgroundColor: 'var(--r0-bg-hover)',
    color: 'var(--r0-fg-subtle)',
    cursor: 'pointer',
    fontSize: '12px',
    padding: '2px 0',
  },
});

// ── Public types ───────────────────────────────────────────────────────────────

export interface EditorContext {
  filename: string;
  language: string;
  code: string;
  type: 'selection' | 'viewport';
  startLine: number;
  endLine: number;
}

export interface DiffHunk {
  fromLine: number;
  toLine: number;
}

export interface EditorHandle {
  getEditorContext: () => EditorContext | null;
  showDiff: (newCode: string, originalContent?: string) => void;
  rejectDiff: () => void;
  undo: () => void;
  redo: () => void;
  cut: () => void;
  copy: () => void;
  paste: () => void;
  selectAll: () => void;
  openFind: () => void;
  formatDocument: () => Promise<string | null>;
  formatSelection: () => Promise<void>;
  /**
   * Push debug breakpoint + paused-line state into the editor in one atomic
   * transaction. Called by App.tsx whenever DebugContext session changes.
   */
  syncBreakpoints: (lines: number[], pausedLine: number | null) => void;
}

interface Props {
  path: string;
  content: string;
  onChange?: (value: string) => void;
  onCursorChange?: (line: number, col: number) => void;
  initialCursor?: { line: number; col: number };
  jumpTo?: { line: number; col: number; key: number };
  onAddToAiContext?: (ctx: EditorContext) => void;
  onAcceptDiff?: () => void;
  onReady?: () => void;
  // LSP props
  rootPath?: string | null;
  onDefinitionJump?: (filePath: string, line: number, col: number) => void;
  onMissingServer?: (language: string, installCmd: string) => void;
  // AI inline autocomplete
  getAiCompletion?: AiCompletionFn;
  // DAP debugging
  onToggleBreakpoint?: (filePath: string, line: number) => void;
}

// ── Component ──────────────────────────────────────────────────────────────────

const Editor = forwardRef<EditorHandle, Props>(function Editor(
  { path, content, onChange, onCursorChange, initialCursor, jumpTo, onAddToAiContext, onAcceptDiff, onReady, rootPath, onDefinitionJump, onMissingServer, getAiCompletion, onToggleBreakpoint }, ref
) {
  const containerRef   = useRef<HTMLDivElement>(null);
  const viewRef        = useRef<EditorView | null>(null);
  const onChangeRef    = useRef(onChange);
  onChangeRef.current  = onChange;
  const onCursorRef    = useRef(onCursorChange);
  onCursorRef.current  = onCursorChange;

  // One Compartment per editor instance — lets us swap in/out the merge extension.
  const mergeCompartment = useRef(new Compartment());
  // LSP extensions compartment — reconfigured per file path
  const lspCompartment = useRef(new Compartment());
  // AI autocomplete compartment — first in extensions so its keymap beats indentWithTab
  const autocompleteCompartment = useRef(new Compartment());
  const localCompletionCompartment = useRef(new Compartment());
  // DAP breakpoint gutter + paused-line highlight compartment
  const dapCompartment = useRef(new Compartment());
  // Stable ref — trigger plugin reads .current so it always calls the latest function
  const getAiCompletionRef = useRef(getAiCompletion);
  getAiCompletionRef.current = getAiCompletion;
  const onToggleBreakpointRef = useRef(onToggleBreakpoint);
  onToggleBreakpointRef.current = onToggleBreakpoint;
  // Stable ref so the LSP definition callback always sees the current value
  const onDefinitionJumpRef = useRef(onDefinitionJump);
  onDefinitionJumpRef.current = onDefinitionJump;
  const onMissingServerRef = useRef(onMissingServer);
  onMissingServerRef.current = onMissingServer;

  const { showToast } = useToast();
  const suggestionSettings = useEditorSuggestionSettings();
  const suggestionSettingsLoaded = useEditorSuggestionSettingsLoaded();
  const suggestionLanguage = getSuggestionLanguage(path);
  const languageSuggestionsEnabled = suggestionSettings.languageEnabled[suggestionLanguage]
    ?? suggestionSettings.languageEnabled.other;
  const aiSuggestionsEnabled = suggestionSettingsLoaded
    && suggestionSettings.inlineSuggestions
    && suggestionSettings.aiInlineCompletions
    && suggestionSettings.showGhostText;

  // Keep onAcceptDiff prop current so the hunk plugin callback never goes stale.
  const onAcceptDiffRef = useRef(onAcceptDiff);
  onAcceptDiffRef.current = onAcceptDiff;

  // Stable indirection into handleAcceptDiff for createHunkControls.
  const hunkAllResolvedRef = useRef<() => void>(() => {});

  // Diff state
  const [diffPending, setDiffPending] = useState(false);
  const diffOriginalRef = useRef<string>('');

  type CtxMenu = { x: number; y: number; ctx: EditorContext | null; hasSelection: boolean };
  const [contextMenu, setContextMenu] = useState<CtxMenu | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const formatRevisionRef = useRef(0);

  useEffect(() => {
    if (!contextMenu) return;
    contextMenuRef.current?.focus();
    function onDown() { setContextMenu(null); }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setContextMenu(null); }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [contextMenu]);

  useImperativeHandle(ref, () => ({
    getEditorContext(): EditorContext | null {
      const view = viewRef.current;
      if (!view) return null;
      const { state } = view;
      const sel = state.selection.main;
      const filename = path.startsWith('__untitled__')
        ? 'Untitled'
        : (path.split(/[/\\]/).pop() ?? path);
      const language = languageLabel(path);

      if (sel.from !== sel.to) {
        const startLine = state.doc.lineAt(sel.from).number;
        const endLine   = state.doc.lineAt(sel.to).number;
        return { filename, language, code: state.sliceDoc(sel.from, sel.to), type: 'selection', startLine, endLine };
      }

      const visible = view.visibleRanges;
      if (!visible.length) return null;
      const from      = visible[0].from;
      const to        = visible[visible.length - 1].to;
      const startLine = state.doc.lineAt(from).number;
      const endLine   = state.doc.lineAt(to).number;
      return { filename, language, code: state.sliceDoc(from, to), type: 'viewport', startLine, endLine };
    },

    showDiff(newCode: string, originalContent?: string) {
      const view = viewRef.current;
      if (!view) return;

      // Use the explicitly supplied original when the view content may be stale
      // (e.g. file just opened — CodeMirror view was created before content loaded).
      const original = originalContent !== undefined ? originalContent : view.state.doc.toString();
      diffOriginalRef.current = original;

      // Atomically: replace the document + enable the merge extension + per-hunk controls.
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: newCode },
        effects: mergeCompartment.current.reconfigure([
          unifiedMergeView({
            original,
            highlightChanges: true,
            collapseUnchanged: { margin: 3, minSize: 4 },
            mergeControls: false,
          }),
          createHunkControls(() => hunkAllResolvedRef.current()),
        ]),
      });

      setDiffPending(true);
    },


    rejectDiff() {
      handleRejectDiff();
    },

    undo() { if (viewRef.current) cmUndo(viewRef.current); },
    redo() { if (viewRef.current) cmRedo(viewRef.current); },
    selectAll() { if (viewRef.current) cmSelectAll(viewRef.current); },
    openFind() { if (viewRef.current) openSearchPanel(viewRef.current); },
    formatDocument() { return formatCurrentDocument(false); },
    async formatSelection() { await formatCurrentDocument(true); },

    cut() {
      const view = viewRef.current;
      if (!view) return;
      const sel = view.state.selection.main;
      if (sel.from === sel.to) return;
      navigator.clipboard.writeText(view.state.sliceDoc(sel.from, sel.to))
        .then(() => { view.dispatch(view.state.replaceSelection('')); })
        .catch(() => { showToast('Clipboard write failed', 'error'); });
    },

    copy() {
      const view = viewRef.current;
      if (!view) return;
      const sel = view.state.selection.main;
      if (sel.from === sel.to) return;
      navigator.clipboard.writeText(view.state.sliceDoc(sel.from, sel.to))
        .catch(() => { showToast('Clipboard write failed', 'error'); });
    },

    paste() {
      const view = viewRef.current;
      if (!view) return;
      navigator.clipboard.readText()
        .then(text => { view.dispatch(view.state.replaceSelection(text)); })
        .catch(() => { showToast('Clipboard read failed', 'error'); });
    },

    syncBreakpoints(lines: number[], pausedLine: number | null) {
      const view = viewRef.current;
      if (!view) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- heterogeneous CodeMirror StateEffect list
      const effects: import('@codemirror/state').StateEffect<any>[] = [clearBreakpointsEffect.of(null)];
      for (const line of lines) {
        if (line >= 1 && line <= view.state.doc.lines) {
          effects.push(addBreakpointEffect.of(line));
        }
      }
      effects.push(setPausedLineEffect.of(pausedLine));
      view.dispatch({ effects });
    },
  }));

  async function formatCurrentDocument(selectionOnly: boolean): Promise<string | null> {
    const view = viewRef.current;
    if (!view) return null;
    const source = view.state.doc.toString();
    const selection = view.state.selection.main;
    if (selectionOnly && selection.empty) {
      showToast('Select code before formatting the selection', 'info');
      return null;
    }
    const revision = ++formatRevisionRef.current;
    try {
      let result: Awaited<ReturnType<typeof formatSource>>;
      try {
        result = await formatSource(
          source,
          path,
          selectionOnly ? { from: selection.from, to: selection.to } : undefined,
          selection.head,
          rootPath,
        );
      } catch (error) {
        if (!rootPath || !supportsLspFormatting(path)) throw error;
        if (selectionOnly) {
          showToast('The configured language server only supports formatting the full document', 'info');
          return null;
        }
        const languageServerResult = await formatWithLanguageServer(
          path,
          rootPath,
          source,
          selection.head,
        );
        if (!languageServerResult) throw error;
        result = { ...languageServerResult, repairedHtmlHeadings: false };
      }
      if (
        revision !== formatRevisionRef.current ||
        viewRef.current !== view ||
        view.state.doc.toString() !== source
      ) return null;
      if (result.repairedHtmlHeadings) {
        showToast('Corrected mismatched HTML heading tags and formatted the document', 'info');
      }
      if (result.text !== source) {
        view.dispatch({
          changes: { from: 0, to: source.length, insert: result.text },
          selection: { anchor: result.cursorOffset },
          scrollIntoView: true,
        });
      }
      return result.text;
    } catch (error) {
      if (revision !== formatRevisionRef.current || viewRef.current !== view) return null;
      showToast(error instanceof Error ? error.message : String(error), 'error');
      return null;
    }
  }

  function handleAcceptDiff() {
    // Remove merge view, keep the current (modified) document.
    viewRef.current?.dispatch({
      effects: mergeCompartment.current.reconfigure([]),
    });
    setDiffPending(false);
    diffOriginalRef.current = '';
    onAcceptDiffRef.current?.();
  }

  // Keep hunkAllResolvedRef pointing at the latest handleAcceptDiff on every render.
  hunkAllResolvedRef.current = handleAcceptDiff;

  function handleRejectDiff() {
    const view = viewRef.current;
    if (view && diffOriginalRef.current !== '') {
      // Restore original document and remove merge view in one transaction.
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: diffOriginalRef.current },
        effects: mergeCompartment.current.reconfigure([]),
      });
    }
    setDiffPending(false);
    diffOriginalRef.current = '';
  }

  useEffect(() => {
    if (!containerRef.current) return;

    const state = EditorState.create({
      doc: content,
      extensions: [
        // Must be first so ghostKeymap wins the Tab key race over indentWithTab.
        autocompleteCompartment.current.of(
          getAiCompletion && aiSuggestionsEnabled
            ? createAiAutocompleteExtension(getAiCompletionRef, { acceptWithTab: suggestionSettings.acceptWithTab })
            : []
        ),
        localCompletionCompartment.current.of(
          suggestionSettingsLoaded ? createLocalCompletions(path, suggestionSettings) : []
        ),
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightActiveLine(),
        drawSelection(),
        indentOnInput(),
        bracketMatching(),
        closeBrackets(),
        EditorState.languageData.of(() => [{
          closeBrackets: { brackets: ['(', '[', '{', "'", '"', '`'] },
        }]),
        history(),
        syntaxHighlighting(r0Highlight),
        linter(view => getParserDiagnostics(view.state), { delay: 500 }),
        lintGutter(),
        indentationGuides,
        search({ top: false }),
        keymap.of([
          ...closeBracketsKeymap,
          { key: 'Enter', run: insertNewlineInEmptyPair },
          ...defaultKeymap,
          ...historyKeymap,
          indentWithTab,
          ...searchKeymap,
        ]),
        getLanguageExtension(path),
        mergeCompartment.current.of([]),
        lspCompartment.current.of([]),
        dapCompartment.current.of([]),
        r0BaseTheme,
        EditorView.updateListener.of(update => {
          if (update.docChanged) {
            onChangeRef.current?.(update.state.doc.toString());
          }
          if (update.docChanged || update.selectionSet) {
            const pos  = update.state.selection.main.head;
            const line = update.state.doc.lineAt(pos);
            onCursorRef.current?.(line.number, pos - line.from + 1);
          }
        }),
      ],
    });

    const view = new EditorView({ state, parent: containerRef.current });
    viewRef.current = view;
    // Signal the parent that the imperative handle is now usable.
    // useImperativeHandle runs before useEffect, so editorRef.current is already set.
    onReady?.();

    // Restore cursor position from previous visit to this file
    if (initialCursor && (initialCursor.line > 1 || initialCursor.col > 1)) {
      const doc     = view.state.doc;
      const lineNum = Math.min(Math.max(1, initialCursor.line), doc.lines);
      const line    = doc.line(lineNum);
      const ch      = Math.max(0, Math.min(initialCursor.col - 1, line.length));
      view.dispatch({ selection: { anchor: line.from + ch }, scrollIntoView: true });
    }

    view.focus();

    return () => {
      view.destroy();
      viewRef.current = null;
      setDiffPending(false);
      diffOriginalRef.current = '';
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  // Jump to line when triggered from search results
  useEffect(() => {
    const view = viewRef.current;
    if (!jumpTo || !view) return;
    const doc     = view.state.doc;
    const lineNum = Math.min(Math.max(1, jumpTo.line), doc.lines);
    const line    = doc.line(lineNum);
    const ch      = Math.max(0, Math.min((jumpTo.col ?? 1) - 1, line.length));
    view.dispatch({ selection: { anchor: line.from + ch }, scrollIntoView: true });
    view.focus();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jumpTo?.key]);

  // LSP session — install extensions when a supported file is open in a workspace
  useEffect(() => {
    if (!suggestionSettingsLoaded || !suggestionSettings.semanticIntelliSense || !rootPath || path.startsWith('__')) return;
    if (!getLspLanguage(path)) return;

    let cancelled = false;
    const activateOnTyping = suggestionSettings.enabled
      && suggestionSettings.showWhileTyping
      && languageSuggestionsEnabled;
    createLspExtension({
      filePath: path,
      rootPath,
      activateOnTyping,
      activateOnTypingDelay: suggestionSettings.debounceMs,
      maxRenderedOptions: suggestionSettings.maxItems,
      showDetails: suggestionSettings.showDetails,
      onDefinitionJump: (fp, ln, col) => onDefinitionJumpRef.current?.(fp, ln, col),
      onMissingServer: (lang, cmd) => onMissingServerRef.current?.(lang, cmd),
    }).then(exts => {
      if (cancelled) return;
      const v = viewRef.current;
      if (v) v.dispatch({ effects: lspCompartment.current.reconfigure(exts) });
    });

    return () => {
      cancelled = true;
      const v = viewRef.current;
      // eslint-disable-next-line react-hooks/exhaustive-deps -- lspCompartment is a stable ref, never reassigned
      if (v) v.dispatch({ effects: lspCompartment.current.reconfigure([]) });
    };
  }, [
    path,
    rootPath,
    suggestionSettingsLoaded,
    suggestionSettings.semanticIntelliSense,
    suggestionSettings.enabled,
    suggestionSettings.showWhileTyping,
    languageSuggestionsEnabled,
    suggestionSettings.debounceMs,
    suggestionSettings.maxItems,
    suggestionSettings.showDetails,
  ]);

  // DAP breakpoint gutter — install/teardown per file path
  useEffect(() => {
    if (path.startsWith('__')) return;
    const view = viewRef.current;
    if (!view) return;
    const exts = createDapExtension({
      filePath: path,
      onToggleBreakpoint: (line) => onToggleBreakpointRef.current?.(path, line),
    });
    view.dispatch({ effects: dapCompartment.current.reconfigure(exts) });
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps -- dapCompartment is a stable ref, never reassigned
      viewRef.current?.dispatch({ effects: dapCompartment.current.reconfigure([]) });
    };
  }, [path]);

  // Reconfigure autocomplete compartment when the prop goes from undefined ↔ function.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dom.classList.toggle('r0-hide-completion-docs', !suggestionSettings.showDocumentation);
    view.dispatch({
      effects: autocompleteCompartment.current.reconfigure(
        getAiCompletion && aiSuggestionsEnabled
          ? createAiAutocompleteExtension(getAiCompletionRef, { acceptWithTab: suggestionSettings.acceptWithTab })
          : []
      ),
    });
    view.dispatch({
      effects: localCompletionCompartment.current.reconfigure(createLocalCompletions(path, suggestionSettings)),
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!getAiCompletion, aiSuggestionsEnabled, suggestionSettingsLoaded, suggestionSettings, path]);

  function handleContextMenu(e: React.MouseEvent) {
    const view = viewRef.current;
    if (!view) return;
    e.preventDefault();
    const initialSelection = view.state.selection.main;
    const pointerPos = view.posAtCoords({ x: e.clientX, y: e.clientY });
    if (
      pointerPos !== null &&
      (initialSelection.empty || pointerPos < initialSelection.from || pointerPos > initialSelection.to)
    ) {
      view.dispatch({ selection: { anchor: pointerPos } });
    }
    view.focus();
    const selection = view.state.selection.main;
    let ctx: EditorContext | null = null;
    if (selection.from !== selection.to && onAddToAiContext) {
      const filename = path.startsWith('__untitled__') ? 'Untitled' : (path.split(/[/\\]/).pop() ?? path);
      const startLine = view.state.doc.lineAt(selection.from).number;
      const endLine = view.state.doc.lineAt(selection.to).number;
      ctx = {
        filename,
        language: languageLabel(path),
        code: view.state.sliceDoc(selection.from, selection.to),
        type: 'selection',
        startLine,
        endLine,
      };
    }
    setContextMenu({
      x: Math.max(8, Math.min(e.clientX, window.innerWidth - 240)),
      y: Math.max(8, Math.min(e.clientY, window.innerHeight - 320)),
      ctx,
      hasSelection: selection.from !== selection.to,
    });
  }

  function runContextAction(action: () => void) {
    setContextMenu(null);
    action();
  }

  function contextMenuItem(label: string, shortcut: string | undefined, action: () => void, disabled = false) {
    return (
      <button
        key={label}
        role="menuitem"
        disabled={disabled}
        onClick={() => runContextAction(action)}
        style={{ ...menuItemStyle, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1 }}
        onMouseEnter={event => {
          if (!disabled) event.currentTarget.style.background = 'var(--r0-bg-hover)';
        }}
        onMouseLeave={event => { event.currentTarget.style.background = 'transparent'; }}
      >
        <span>{label}</span>
        {shortcut && <span style={{ color: 'var(--r0-fg-subtle)', fontSize: 10 }}>{shortcut}</span>}
      </button>
    );
  }

  return (
    <>
      <div
        ref={containerRef}
        onContextMenu={handleContextMenu}
        style={{ flex: 1, overflow: 'hidden', height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}
      >
        {/* Accept / Reject overlay — shown while a diff is pending */}
        {diffPending && (
          <div
            style={{
              position: 'absolute',
              top: 8,
              right: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              zIndex: 50,
              backgroundColor: 'var(--r0-bg-base)',
              border: '1px solid var(--r0-border-default)',
              borderRadius: 7,
              padding: '4px 6px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
              fontSize: '11px',
              fontFamily: 'var(--font-sans)',
            }}
          >
            <span style={{
              padding: '2px 8px',
              borderRadius: 4,
              backgroundColor: 'var(--r0-fg-default)',
              color: 'var(--r0-bg-base)',
              fontWeight: 600,
              letterSpacing: '0.01em',
              userSelect: 'none',
            }}>
              Review changes
            </span>
            <button
              onClick={handleAcceptDiff}
              style={{
                padding: '3px 11px',
                borderRadius: 5,
                border: 'none',
                backgroundColor: 'var(--r0-semantic-success)',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '11px',
                fontFamily: 'var(--font-sans)',
                fontWeight: 500,
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'color-mix(in srgb, var(--r0-semantic-success) 80%, white)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--r0-semantic-success)'; }}
            >
              Accept All
            </button>
            <button
              onClick={handleRejectDiff}
              style={{
                padding: '3px 11px',
                borderRadius: 5,
                border: 'none',
                backgroundColor: 'var(--r0-semantic-error)',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '11px',
                fontFamily: 'var(--font-sans)',
                fontWeight: 500,
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'color-mix(in srgb, var(--r0-semantic-error) 80%, white)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--r0-semantic-error)'; }}
            >
              Reject All
            </button>
          </div>
        )}
      </div>

      {contextMenu && createPortal(
        <div
          ref={contextMenuRef}
          role="menu"
          aria-label="Editor actions"
          tabIndex={-1}
          onMouseDown={e => e.stopPropagation()}
          style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            minWidth: '200px',
            background: 'var(--r0-bg-base)',
            border: '1px solid var(--r0-border-default)',
            borderRadius: '8px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.22)',
            padding: '4px',
            zIndex: 9999,
          }}
        >
          {contextMenuItem('Undo', shortcutLabel('r0.editorUndo'), () => { if (viewRef.current) cmUndo(viewRef.current); })}
          {contextMenuItem('Redo', shortcutLabel('r0.editorRedo'), () => { if (viewRef.current) cmRedo(viewRef.current); })}
          <div style={menuSeparatorStyle} />
          {contextMenuItem('Cut', shortcutLabel('r0.editorCut'), () => {
            const view = viewRef.current;
            if (!view) return;
            const selection = view.state.selection.main;
            navigator.clipboard.writeText(view.state.sliceDoc(selection.from, selection.to))
              .then(() => {
                if (viewRef.current === view) view.dispatch(view.state.replaceSelection(''));
              })
              .catch(() => showToast('Clipboard write failed', 'error'));
          }, !contextMenu.hasSelection)}
          {contextMenuItem('Copy', shortcutLabel('r0.editorCopy'), () => {
            const view = viewRef.current;
            if (view) {
              const selection = view.state.selection.main;
              navigator.clipboard.writeText(view.state.sliceDoc(selection.from, selection.to))
                .catch(() => showToast('Clipboard write failed', 'error'));
            }
          }, !contextMenu.hasSelection)}
          {contextMenuItem('Paste', shortcutLabel('r0.editorPaste'), () => {
            const view = viewRef.current;
            if (view) {
              navigator.clipboard.readText()
                .then(text => {
                  if (viewRef.current === view) view.dispatch(view.state.replaceSelection(text));
                })
                .catch(() => showToast('Clipboard read failed', 'error'));
            }
          })}
          {contextMenuItem('Select All', shortcutLabel('r0.editorSelectAll'), () => { if (viewRef.current) cmSelectAll(viewRef.current); })}
          {canFormat(path) && (
            <>
              <div style={menuSeparatorStyle} />
              {contextMenuItem('Format Document', shortcutLabel('r0.formatDocument'), () => { void formatCurrentDocument(false); })}
              {contextMenu.hasSelection && contextMenuItem('Format Selection', undefined, () => { void formatCurrentDocument(true); })}
            </>
          )}
          {contextMenu.ctx && (
            <>
              <div style={menuSeparatorStyle} />
              <button
                role="menuitem"
                onClick={() => {
                  onAddToAiContext?.(contextMenu.ctx!);
                  setContextMenu(null);
                }}
                style={{ ...menuItemStyle, alignItems: 'flex-start', flexDirection: 'column', gap: 2 }}
                onMouseEnter={event => { event.currentTarget.style.background = 'var(--r0-bg-hover)'; }}
                onMouseLeave={event => { event.currentTarget.style.background = 'transparent'; }}
              >
                <span>Ask AI about this</span>
                <span style={{ fontSize: 10, color: 'var(--r0-fg-subtle)' }}>
                  L{contextMenu.ctx.startLine}-{contextMenu.ctx.endLine} · {contextMenu.ctx.filename}
                </span>
              </button>
            </>
          )}
        </div>,
        document.body,
      )}
    </>
  );
});

const menuItemStyle: React.CSSProperties = {
  width: '100%',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '6px 9px',
  borderRadius: 4,
  border: 0,
  color: 'var(--r0-fg-default)',
  background: 'transparent',
  cursor: 'pointer',
  fontSize: 12,
  textAlign: 'left',
};

const menuSeparatorStyle: React.CSSProperties = {
  height: 1,
  margin: '4px 5px',
  background: 'var(--r0-border-default)',
};

function shortcutLabel(commandId: string): string | undefined {
  const key = getEffectiveKey(commandId);
  if (!key) return undefined;
  return key.split('+').map(part => {
    if (part === 'ctrl' || part === 'cmd') return 'Ctrl';
    if (part === 'alt') return 'Alt';
    if (part === 'shift') return 'Shift';
    if (part === 'space') return 'Space';
    return part.length === 1 ? part.toUpperCase() : part[0].toUpperCase() + part.slice(1);
  }).join('+');
}

export default Editor;
