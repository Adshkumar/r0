import { Files, Search, GitBranch, Bug, Blocks } from "lucide-react";
import { Tooltip } from "./ui/Tooltip";

const items = [
  { id: "explorer",   icon: Files,     label: "Explorer" },
  { id: "search",     icon: Search,    label: "Search" },
  { id: "sourcetree", icon: GitBranch, label: "Source Control" },
  { id: "debug",      icon: Bug,       label: "Debug" },
  { id: "extensions", icon: Blocks,    label: "Extensions" },
];

interface ActivityBarProps {
  active: string;
  onSelect: (id: string) => void;
}

export default function ActivityBar({ active, onSelect }: ActivityBarProps) {
  return (
    <div
      className="flex items-center justify-center gap-1 px-2 py-1 border-b shrink-0"
      style={{ borderColor: "var(--r0-border-default)" }}
    >
      {items.map(({ id, icon: Icon, label }) => {
        const isActive = active === id;
        return (
          <Tooltip key={id} content={label} side="bottom">
            <button
              onClick={() => onSelect(id)}
              className="p-1.5 rounded transition-colors"
              style={{
                color: isActive ? "var(--r0-fg-default)" : "var(--r0-fg-subtle)",
                backgroundColor: isActive ? "var(--r0-bg-active)" : "transparent",
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.color = "var(--r0-fg-muted)";
                if (!isActive) e.currentTarget.style.backgroundColor = "var(--r0-bg-hover)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = isActive ? "var(--r0-fg-default)" : "var(--r0-fg-subtle)";
                e.currentTarget.style.backgroundColor = isActive ? "var(--r0-bg-active)" : "transparent";
              }}
              aria-label={label}
            >
              <Icon size={15} />
            </button>
          </Tooltip>
        );
      })}
    </div>
  );
}
