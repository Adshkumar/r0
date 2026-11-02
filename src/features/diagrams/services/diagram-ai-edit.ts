interface MermaidEditRequest {
  filePath: string;
  source: string;
  instruction: string;
  signal: AbortSignal;
}

export async function requestMermaidEdit({
  filePath,
  source,
  instruction,
  signal,
}: MermaidEditRequest): Promise<string> {
  const { requestInlineEdit } =
    await import("@/features/ai/intelligence/services/intelligence-text-service");
  const { editedText } = await requestInlineEdit(
    {
      model: "",
      beforeSelection: "",
      selectedText: source,
      afterSelection: "",
      instruction,
      filePath,
      languageId: "mermaid",
    },
    { signal },
  );
  return editedText;
}
