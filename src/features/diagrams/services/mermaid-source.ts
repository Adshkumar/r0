const DIAGRAM_DECLARATION =
  /^\s*(?:flowchart|graph|sequenceDiagram|classDiagram|stateDiagram(?:-v2)?|erDiagram|journey|gantt|pie|gitGraph|mindmap|timeline|quadrantChart|requirementDiagram|C4Context|C4Container|C4Component|C4Dynamic|C4Deployment|sankey-beta|xychart-beta|block-beta|packet-beta|kanban|architecture-beta|zenuml|treemap-beta|radar-beta|venn-beta|info|interrupt)\b/i;
const SEQUENCE_MARKER =
  /^\s*(?:(?:actor|participant)\s+\S+|(?:activate|deactivate)\s+\S+|note\s+(?:over|left of|right of|across)\s+\S+)/i;
const SEQUENCE_INTERACTION =
  /^\s*(?:(?:activate|deactivate)\s+\S+|note\s+(?:over|left of|right of|across)\s+\S+|[\w.-]+(?:\s*--?>>?|\s*->>?)\s*[\w.-]+\s*:)/i;

export function normalizeMermaidSource(source: string): string {
  const withoutBom = source.replace(/^\uFEFF/, "");
  const trimmed = withoutBom.trim();
  const fenced = trimmed.match(/^```mermaid\s*\r?\n([\s\S]*?)\r?\n```\s*$/i);
  return (fenced?.[1] ?? withoutBom).replace(/\r\n?/g, "\n");
}

function meaningfulLines(source: string): string[] {
  return normalizeMermaidSource(source)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("%%"));
}

export function hasMermaidDeclaration(source: string): boolean {
  return meaningfulLines(source).some((line) => DIAGRAM_DECLARATION.test(line));
}

export function needsSequenceDiagramDeclaration(source: string): boolean {
  const lines = meaningfulLines(source);
  if (lines.some((line) => DIAGRAM_DECLARATION.test(line))) return false;
  return (
    lines.some((line) => SEQUENCE_MARKER.test(line)) &&
    lines.some((line) => SEQUENCE_INTERACTION.test(line))
  );
}

function findDeclarationInsertionIndex(source: string, startIndex = 0): number {
  let lineStart = startIndex;
  while (lineStart < source.length) {
    const lineEnd = source.indexOf("\n", lineStart);
    const nextLineStart = lineEnd === -1 ? source.length : lineEnd + 1;
    const line = source.slice(lineStart, lineEnd === -1 ? source.length : lineEnd).trim();
    if (line && !line.startsWith("%%")) break;
    lineStart = nextLineStart;
  }
  return lineStart;
}

export function getSequenceDiagramCorrection(source: string): string | null {
  if (!needsSequenceDiagramDeclaration(source)) return null;

  const trimmed = source.replace(/^\uFEFF/, "");
  const malformedDeclaration = /^([ \t]*)sequence\s+diagram\s*;?([ \t]*)$/im;
  if (malformedDeclaration.test(trimmed)) {
    return trimmed.replace(
      malformedDeclaration,
      (_match, leadingWhitespace: string, trailingWhitespace: string) =>
        `${leadingWhitespace}sequenceDiagram${trailingWhitespace}`,
    );
  }

  const openFence = trimmed.match(/^(\s*```mermaid[^\r\n]*\r?\n)/i);
  const insertionIndex = findDeclarationInsertionIndex(trimmed, openFence?.[0].length ?? 0);
  const prefix = trimmed.slice(0, insertionIndex);
  const suffix = trimmed.slice(insertionIndex);
  const separator = prefix.length > 0 && !prefix.endsWith("\n") ? "\n" : "";
  return `${prefix}${separator}sequenceDiagram\n${suffix}`;
}

export function addSequenceDiagramDeclaration(source: string): string | null {
  return getSequenceDiagramCorrection(source);
}

export function getRenderableMermaidSource(source: string): string {
  return getSequenceDiagramCorrection(source) ?? source;
}

export function getMermaidErrorMessage(error: unknown, source: string): string {
  if (needsSequenceDiagramDeclaration(source)) {
    return "Sequence diagram syntax detected. Missing `sequenceDiagram` declaration.";
  }
  if (error instanceof Error && error.message.trim()) return error.message;
  return "Unable to render this Mermaid diagram. Check its declaration and syntax.";
}
