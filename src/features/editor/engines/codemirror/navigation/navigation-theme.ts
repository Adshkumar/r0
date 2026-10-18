import { EditorView } from "@codemirror/view";

/** Styles for the LSP navigation layers (links, inlay hints, code lenses, references peek). */
export const lspNavigationTheme = EditorView.theme({
  ".cm-r0-definition-link": {
    cursor: "pointer",
    textDecoration: "underline",
    color: "var(--app-primary)",
  },
  ".cm-r0-definition-link *": { color: "inherit" },
  ".cm-r0-inlay-hint": {
    display: "inline-block",
    padding: "0 0.3em",
    borderRadius: "var(--radius-xs, 3px)",
    backgroundColor: "var(--accent)",
    color: "var(--app-subtle-foreground)",
    fontSize: "0.9em",
    lineHeight: "1.3",
    verticalAlign: "baseline",
    userSelect: "none",
    pointerEvents: "none",
  },
  ".cm-r0-inlay-hint[data-padding-left]": { marginLeft: "0.3em" },
  ".cm-r0-inlay-hint[data-padding-right]": { marginRight: "0.3em" },
  ".cm-r0-code-lens": {
    display: "flex",
    alignItems: "center",
    gap: "0.4em",
    fontFamily: "var(--font-sans)",
    fontSize: "0.85em",
    lineHeight: "1.6",
    color: "var(--app-subtle-foreground)",
    whiteSpace: "nowrap",
    userSelect: "none",
  },
  ".cm-r0-code-lens-item": {
    padding: "0",
    border: "none",
    background: "none",
    color: "inherit",
    font: "inherit",
    cursor: "pointer",
  },
  ".cm-r0-code-lens-item:hover, .cm-r0-code-lens-item:focus-visible": {
    color: "var(--app-primary)",
    textDecoration: "underline",
    outline: "none",
  },
  ".cm-r0-references-peek": {
    position: "sticky",
    boxSizing: "border-box",
    whiteSpace: "normal",
    cursor: "default",
    caretColor: "transparent",
  },
});
