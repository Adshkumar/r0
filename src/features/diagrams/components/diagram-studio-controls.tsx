import Select from "@/ui/select";
import { HistoryIcon } from "@/ui/icons";
import { ToggleGroup } from "@/ui/toggle-group";
import { Button } from "@/ui/button";
import {
  DIAGRAM_TEMPLATES,
  type DiagramViewMode,
} from "@/features/diagrams/services/diagram-document";

const viewOptions: Array<{ value: DiagramViewMode; label: string }> = [
  { value: "source", label: "Source" },
  { value: "split", label: "Split" },
  { value: "preview", label: "Preview" },
];

export function DiagramStudioControls({
  mode,
  onModeChange,
  onInsertTemplate,
  onOpenHistory,
  disabled,
}: {
  mode: DiagramViewMode;
  onModeChange: (mode: DiagramViewMode) => void;
  onInsertTemplate: (content: string) => void;
  onOpenHistory?: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-center gap-1">
      <ToggleGroup
        type="single"
        variant="segmented"
        wrap={false}
        ariaLabel="Diagram view"
        options={viewOptions}
        value={mode}
        onValueChange={onModeChange}
      />
      <Select
        aria-label="Insert Mermaid template"
        value=""
        options={DIAGRAM_TEMPLATES.map(({ id, label, category, description }) => ({
          value: id,
          label: `${category} · ${label}`,
          keywords: [category, label, description],
        }))}
        onChange={(value) => {
          const template = DIAGRAM_TEMPLATES.find((item) => item.id === value);
          if (template) onInsertTemplate(template.content);
        }}
        placeholder="Template"
        variant="ghost"
        disabled={disabled}
        searchable
        emptyLabel="No matching templates"
      />
      {onOpenHistory ? (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          aria-label="Open diagram version history"
          title="Open diagram version history"
          onClick={onOpenHistory}
        >
          <HistoryIcon />
        </Button>
      ) : null}
    </div>
  );
}
