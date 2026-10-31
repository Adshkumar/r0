import { getAgentCli } from "@/features/ai/services/agent-clis";
import type { PendingAgentAction } from "@/features/ai/services/agent-options";
import { openAgentCliInTerminal } from "@/features/ai/services/open-agent-cli-in-terminal";
import { useAgentCatalogStore } from "@/features/ai/stores/agent-catalog.store";
import { useSettingsStore } from "@/features/settings/stores/settings.store";
import { Alert, AlertActions, AlertDescription, AlertTitle } from "@/ui/alert";
import Badge from "@/ui/badge";
import { Button } from "@/ui/button";
import { menuSeparator, type MenuItem } from "@/ui/dropdown";
import { EmptyState } from "@/ui/empty";
import { GroupedSection } from "@/ui/grouped-section";
import { ArrowUpIcon, ChatBubbleTextIcon, SignInIcon, TrashIcon } from "@/ui/icons";
import { Spinner } from "@/ui/spinner";
import { groupCustomizeAgents } from "../services/customize-catalog";
import type { CustomizeAgent, CustomizeTab } from "../types/customize.types";
import {
  CustomizeAddButton,
  CustomizeMoreMenu,
  CustomizeRow,
  CustomizeRowNote,
} from "./customize-row";

const BUSY_LABELS = { install: "Installing", update: "Updating", uninstall: "Removing" } as const;

export function agentMenuItems(agent: CustomizeAgent): MenuItem[] {
  const { runAgentAction } = useAgentCatalogStore.getState().actions;
  const updateSetting = useSettingsStore.getState().actions.updateSetting;

  const items: MenuItem[] = [];
  if (agent.updateAvailable) {
    items.push({
      id: "update",
      label: "Update",
      icon: <ArrowUpIcon />,
      onClick: () => void runAgentAction(agent.id, agent.name, "update"),
    });
  }
  const cli = getAgentCli(agent.id);
  if (cli) {
    items.push({
      id: "sign-in",
      label: `Sign in with ${cli.name}`,
      icon: <SignInIcon />,
      onClick: () => void openAgentCliInTerminal(agent.id),
    });
  }
  const supportsInstalledVisibility = agent.id === "codex" || agent.id === "github-copilot-cli";
  if (supportsInstalledVisibility) {
    if (items.length > 0) items.push(menuSeparator("uninstall-separator"));
    items.push({
      id: "uninstall",
      label: agent.isHidden ? "Add to Installed" : "Remove from Installed",
      icon: <TrashIcon />,
      tone: agent.isHidden ? undefined : "destructive",
      onClick: () => {
        if (agent.isHidden) {
          const hidden = useSettingsStore.getState().settings.hiddenAgentIds;
          void updateSetting(
            "hiddenAgentIds",
            hidden.filter((id) => id !== agent.id),
          );
        } else {
          void runAgentAction(agent.id, agent.name, "uninstall");
        }
      },
    });
  } else if (agent.canInstall) {
    if (items.length > 0) items.push(menuSeparator("uninstall-separator"));
    items.push({
      id: "uninstall",
      label: "Uninstall",
      icon: <TrashIcon />,
      tone: "destructive",
      onClick: () => void runAgentAction(agent.id, agent.name, "uninstall"),
    });
  }
  return items;
}

function AgentAction({
  agent,
  pendingAction,
}: {
  agent: CustomizeAgent;
  pendingAction: PendingAgentAction | null;
}) {
  if (pendingAction?.agentId === agent.id) {
    return <Spinner compact label={BUSY_LABELS[pendingAction.action]} />;
  }
  if (agent.isInstalled) {
    const items = agentMenuItems(agent);
    return items.length > 0 ? (
      <CustomizeMoreMenu label={`${agent.name} actions`} items={items} />
    ) : null;
  }
  if (agent.canInstall) {
    return (
      <CustomizeAddButton
        label={`Install ${agent.name}`}
        busy={pendingAction?.agentId === agent.id}
        onClick={() =>
          void useAgentCatalogStore
            .getState()
            .actions.runAgentAction(agent.id, agent.name, "install")
        }
      />
    );
  }
  return <CustomizeRowNote title={agent.unavailableReason}>Unavailable</CustomizeRowNote>;
}

function AgentRow({
  agent,
  pendingAction,
  revealed,
}: {
  agent: CustomizeAgent;
  pendingAction: PendingAgentAction | null;
  revealed?: boolean;
}) {
  return (
    <CustomizeRow
      title={agent.name}
      description={agent.description}
      brand={agent.brand}
      revealed={revealed}
      status={agent.updateAvailable ? <Badge tone="accent">Update</Badge> : null}
      action={<AgentAction agent={agent} pendingAction={pendingAction} />}
    />
  );
}

export function AgentsSection({
  tab,
  query,
  agents,
  revealedItemId,
  onShowCatalog,
}: {
  tab: CustomizeTab;
  query: string;
  agents: CustomizeAgent[];
  revealedItemId: string | null;
  onShowCatalog: () => void;
}) {
  const status = useAgentCatalogStore.use.agents();
  const pendingAction = useAgentCatalogStore.use.pendingAction();
  const refresh = useAgentCatalogStore.use.actions().refresh;
  const visible =
    tab === "installed" ? agents.filter((agent) => agent.isInstalled && !agent.isHidden) : agents;
  const groups = groupCustomizeAgents(visible, query);

  const loadError = status.error ? (
    <Alert tone="error" className="mb-4">
      <AlertTitle>Some agents could not be found</AlertTitle>
      <AlertDescription>{status.error}</AlertDescription>
      <AlertActions>
        <Button type="button" variant="ghost" size="sm" onClick={() => void refresh(true)}>
          Try again
        </Button>
      </AlertActions>
    </Alert>
  ) : null;

  if (groups.length === 0) {
    const isLoading = status.data === null && status.status !== "error";
    return (
      <>
        {loadError}
        {isLoading ? (
          <EmptyState
            className="min-h-64"
            message={<Spinner label="Looking for agents" showLabel compact />}
          />
        ) : (
          <EmptyState
            className="min-h-64"
            icon={<ChatBubbleTextIcon />}
            title={tab === "installed" && !query ? "No agents installed" : "No agents match"}
            action={
              tab === "installed" ? { label: "Browse agents", onClick: onShowCatalog } : undefined
            }
          />
        )}
      </>
    );
  }

  return (
    <>
      {loadError}
      <div className="flex flex-col gap-8">
        {tab === "installed" ? (
          <GroupedSection title="Installed" variant="grid">
            {groups
              .flatMap((group) => group.rows)
              .map((agent) => (
                <AgentRow
                  key={agent.id}
                  agent={agent}
                  pendingAction={pendingAction}
                  revealed={revealedItemId === agent.id}
                />
              ))}
          </GroupedSection>
        ) : (
          groups.map((group) => (
            <GroupedSection key={group.id} title={group.label} variant="grid">
              {group.rows.map((agent) => (
                <AgentRow key={agent.id} agent={agent} pendingAction={pendingAction} />
              ))}
            </GroupedSection>
          ))
        )}
      </div>
    </>
  );
}
