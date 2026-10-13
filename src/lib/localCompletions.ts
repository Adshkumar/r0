import {
  autocompletion,
  type Completion,
  type CompletionContext,
  type CompletionResult,
  type CompletionSource,
  startCompletion,
} from '@codemirror/autocomplete';
import { keymap } from '@codemirror/view';
import { Prec, type Extension } from '@codemirror/state';
import type { EditorSuggestionSettings } from './settings';

export type SuggestionLanguage = 'javascript' | 'typescript' | 'python' | 'rust' | 'html' | 'css' | 'json' | 'other';

interface CompletionItem {
  label: string;
  type: string;
  detail?: string;
  insert?: string;
  info?: string;
}

const JS_WORDS = words('async await break case catch class const continue debugger default delete do else export extends finally for from function get if import in instanceof let new of return set static super switch this throw try typeof var void while with yield interface type enum namespace implements public private protected readonly abstract as satisfies keyof infer declare module');
const JS_GLOBALS = words('Array BigInt Boolean Date Error EvalError Intl JSON Map Math NaN Number Object Promise Proxy Reflect RegExp Set String Symbol WeakMap WeakSet console document globalThis navigator window');
const JS_MEMBERS: Record<string, string> = {
  console: 'assert clear count countReset debug dir error group groupCollapsed groupEnd info log table time timeEnd trace warn',
  Math: 'abs acos acosh asin asinh atan atan2 atanh cbrt ceil clz32 cos cosh exp expm1 floor fround hypot imul log log10 log1p log2 max min pow random round sign sin sinh sqrt tan tanh trunc PI E LN2 LN10',
  JSON: 'parse stringify',
  Array: 'from fromAsync isArray of',
  Object: 'assign create entries freeze fromEntries getOwnPropertyDescriptor getOwnPropertyNames keys values',
  String: 'fromCharCode fromCodePoint raw',
  Date: 'now parse UTC',
  Promise: 'all allSettled any race reject resolve withResolvers',
  document: 'activeElement body createElement createTextNode getElementById querySelector querySelectorAll title',
  window: 'addEventListener alert confirm document fetch location localStorage matchMedia open removeEventListener setInterval setTimeout',
};
const PY_WORDS = words('and as assert async await break class continue def del elif else except False finally for from global if import in is lambda None nonlocal not or pass raise return True try while with yield');
const PY_GLOBALS = words('abs all any ascii bin bool breakpoint bytearray bytes callable chr classmethod compile complex delattr dict dir divmod enumerate eval filter float format frozenset getattr globals hasattr hash help hex id input int isinstance issubclass iter len list locals map max memoryview min next object oct open ord pow print property range repr reversed round set setattr slice sorted staticmethod str sum super tuple type vars zip __import__');
const PY_MEMBERS: Record<string, string> = {
  math: 'ceil copysign factorial floor fmod gcd hypot isclose isfinite isnan log log10 pi pow radians sin sqrt',
  os: 'chdir environ getcwd listdir makedirs mkdir path remove rename rmdir walk',
  sys: 'argv exit path platform stderr stdin stdout version',
  str: 'capitalize casefold center count encode endswith expandtabs find format index isalnum isalpha isdigit islower join lower lstrip replace rfind rsplit split startswith strip title upper',
  list: 'append clear copy count extend index insert pop remove reverse sort',
  dict: 'clear copy get items keys pop setdefault update values',
  set: 'add clear copy difference discard intersection isdisjoint issubset issuperset pop remove union update',
};
const RUST_WORDS = words('as async await break const continue crate dyn else enum extern false fn for if impl in let loop match mod move mut pub ref return self Self static struct super trait true type unsafe use where while');
const RUST_GLOBALS = words('Box Clone Copy Default Err Error HashMap HashSet Iterator Option Ok Result String ToString Vec');
const RUST_MEMBERS: Record<string, string> = {
  String: 'from from_utf8 from_utf8_lossy new with_capacity',
  Vec: 'append capacity clear contains drain extend_from_slice first from get insert is_empty iter len new pop push remove reserve reverse sort split_off truncate with_capacity',
  Option: 'and_then expect filter is_none is_some map ok_or unwrap unwrap_or',
  Result: 'and_then err expect is_err is_ok map map_err unwrap unwrap_or',
};
const HTML_WORDS = words('a article aside audio body br button canvas code div em footer form h1 h2 h3 head header html img input label li link main meta nav ol option p script section select small span strong style table tbody td textarea th thead title tr ul video');
const CSS_WORDS = words('align-content align-items animation background border bottom box-shadow color display flex font font-family font-size gap grid height justify-content left margin max-width min-height opacity overflow padding position right top transform transition width z-index');
const JSON_WORDS = words('false null true');

function words(value: string): string[] {
  return value.split(/\s+/).filter(Boolean);
}

export function getSuggestionLanguage(path: string): SuggestionLanguage {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'js' || ext === 'jsx' || ext === 'mjs' || ext === 'cjs') return 'javascript';
  if (ext === 'ts' || ext === 'tsx' || ext === 'mts' || ext === 'cts') return 'typescript';
  if (ext === 'py' || ext === 'pyi') return 'python';
  if (ext === 'rs') return 'rust';
  if (ext === 'html' || ext === 'htm' || ext === 'svg') return 'html';
  if (ext === 'css' || ext === 'scss' || ext === 'sass') return 'css';
  if (ext === 'json' || ext === 'jsonc') return 'json';
  return 'other';
}

function memberItems(language: SuggestionLanguage, expression: string): CompletionItem[] {
  const name = expression.split('.').pop() ?? expression;
  const names = language === 'python'
    ? PY_MEMBERS[name]
    : language === 'rust'
      ? RUST_MEMBERS[name]
      : JS_MEMBERS[name];
  return names ? words(names).map(label => ({
    label,
    type: /^[A-Z]/.test(label) ? 'constant' : 'function',
    detail: 'Built-in member',
    insert: /^(?:log|error|warn|info|debug|table|time|parse|stringify|abs|ceil|floor|max|min|random|round|sqrt|pow|append|extend|insert|pop|push|remove|sort|new|from|with_capacity|unwrap|expect|map|get|set|querySelector|createElement|addEventListener|fetch|setTimeout)$/.test(label)
      ? `${label}()`
      : undefined,
  })) : [];
}

function languageItems(language: SuggestionLanguage): CompletionItem[] {
  const list = language === 'javascript' || language === 'typescript'
    ? [...JS_WORDS, ...JS_GLOBALS]
    : language === 'python'
      ? [...PY_WORDS, ...PY_GLOBALS]
      : language === 'rust'
        ? [...RUST_WORDS, ...RUST_GLOBALS]
        : language === 'html'
          ? HTML_WORDS
          : language === 'css'
            ? CSS_WORDS
            : language === 'json'
              ? JSON_WORDS
              : [];
  return list.map(label => ({
    label,
    type: 'keyword',
    detail: 'Language keyword or built-in',
  }));
}

function localSymbols(source: string, language: SuggestionLanguage): CompletionItem[] {
  const clipped = source.slice(-100_000);
  const pattern = language === 'python'
    ? /^\s*(?:async\s+def|def|class|import|from\s+\S+\s+import)\s+([A-Za-z_]\w*)/gm
    : language === 'rust'
      ? /^\s*(?:(?:pub(?:\([^)]*\))?\s+)?(?:async\s+)?fn|(?:pub(?:\([^)]*\))?\s+)?(?:struct|enum|trait|type|mod|const|static)\s+|let\s+(?:mut\s+)?)([A-Za-z_]\w*)/gm
      : /^\s*(?:(?:export\s+)?(?:async\s+)?function|(?:export\s+)?class|(?:export\s+)?(?:const|let|var|type|interface|enum)\s+|import\s+(?:type\s+)?)([A-Za-z_$][\w$]*)/gm;
  const labels = new Set<string>();
  for (const match of clipped.matchAll(pattern)) {
    if (match[1]) labels.add(match[1]);
  }
  return [...labels].map(label => ({
    label,
    type: 'variable',
    detail: 'Declared in this file',
  }));
}

function itemToCompletion(item: CompletionItem, showDetails: boolean, showDocumentation: boolean): Completion {
  return {
    label: item.label,
    type: item.type,
    detail: showDetails ? item.detail : undefined,
    info: showDocumentation && item.info ? item.info : undefined,
    apply: item.insert
      ? (view, _completion, from, to) => {
          const cursorInsideCall = item.insert?.endsWith('()') ? item.insert.length - 1 : item.insert?.length ?? 0;
          view.dispatch({
            changes: { from, to, insert: item.insert ?? item.label },
            selection: { anchor: from + cursorInsideCall },
          });
        }
      : undefined,
  };
}

export function createLocalCompletionSource(
  path: string,
  options: Pick<EditorSuggestionSettings, 'showDocumentation' | 'showDetails' | 'maxItems'>,
): CompletionSource {
  const language = getSuggestionLanguage(path);
  return (context: CompletionContext): CompletionResult | null => {
    const line = context.state.doc.lineAt(context.pos);
    const before = line.text.slice(0, context.pos - line.from);
    const member = before.match(/([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\.\s*([\w$]*)$/);
    const match = context.matchBefore(/[\w$]+/);
    if (!context.explicit && !member && (!match || match.from === match.to)) return null;

    const from = member ? context.pos - (member[2]?.length ?? 0) : match?.from ?? context.pos;
    const baseItems = member
      ? memberItems(language, member[1])
      : [...localSymbols(context.state.doc.sliceString(0, context.pos), language), ...languageItems(language)];
    const optionsList = baseItems
      .filter(item => !match || member || item.label.toLowerCase().includes(match.text.toLowerCase()))
      .slice(0, options.maxItems)
      .map(item => itemToCompletion(item, options.showDetails, options.showDocumentation));
    if (!optionsList.length) return null;
    return {
      from,
      options: optionsList,
      validFor: /^[\w$]*$/,
    };
  };
}

export function createLocalCompletions(
  path: string,
  settings: EditorSuggestionSettings,
): Extension {
  const language = getSuggestionLanguage(path);
  const languageEnabled = settings.languageEnabled[language] ?? settings.languageEnabled.other;
  const source = createLocalCompletionSource(path, settings);
  const completionEnabled = settings.enabled && languageEnabled;
  return [
    autocompletion({
      activateOnTyping: completionEnabled && settings.showWhileTyping,
      activateOnTypingDelay: settings.debounceMs,
      maxRenderedOptions: settings.maxItems,
      override: completionEnabled || settings.manualSuggestions ? [source] : [],
      closeOnBlur: true,
      defaultKeymap: true,
      icons: settings.showDetails,
    }),
    Prec.highest(keymap.of([{
      key: 'Ctrl-Space',
      run: view => {
        if (!settings.manualSuggestions) return true;
        return startCompletion(view);
      },
      preventDefault: true,
    }])),
  ];
}
