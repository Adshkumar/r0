import type { AgentMessageSubmitResult, AgentType } from "@/features/ai/types/ai-chat.types";
import { getProviderById } from "@/features/ai/types/providers.types";

/**
 * Why R0's own agent can't send with this provider: R0 models need an R0 account, the
 * others need the user's API key for that provider.
 */
export function getProviderAccessError(providerId: string): string {
  if (providerId === "r0") return "Sign in to R0 to use R0 models.";
  const name = getProviderById(providerId)?.name ?? "this provider";
  return `Add your ${name} API key in Settings to use ${name} models.`;
}

export function getAgentMessageAccess(
  agentId: AgentType,
  hasProviderAccess: boolean,
  providerId?: string,
): AgentMessageSubmitResult {
  if (agentId !== "custom" || hasProviderAccess) {
    return { accepted: true };
  }

  return {
    accepted: false,
    error: providerId
      ? getProviderAccessError(providerId)
      : "Add an API key in Settings to use this provider.",
  };
}
