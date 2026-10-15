import { ROLE_LABEL, type AccountRole } from "@/lib/types";

/**
 * What the board is told after a role changes. Access is reset to that
 * office's defaults, and a person who changes a role should hear it rather
 * than find a grid they had adjusted quietly put back.
 */
export function roleChangeMessage(name: string, role: AccountRole): string {
  if (role === "resident") {
    return `${name} is no longer on the board. Access set to the ${ROLE_LABEL.resident} defaults; adjust it below.`;
  }
  return `${name} is ${ROLE_LABEL[role]}. Access set to the ${ROLE_LABEL[role]} defaults; adjust it below.`;
}

/** What the board is told when the owner has not signed in yet: the office waits for them. */
export function waitingRoleMessage(name: string, role: AccountRole): string {
  return `${name} is ${ROLE_LABEL[role]}. They get board access when they sign in.`;
}
