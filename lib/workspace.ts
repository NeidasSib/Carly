export type WorkspaceSelection =
  | { raw: string; type: "personal" }
  | { raw: string; type: "company"; companyId: string };

export function parseWorkspaceParam(
  input: string | null | undefined
): WorkspaceSelection {
  const raw = (input ?? "personal").trim();
  if (raw.startsWith("company:")) {
    const companyId = raw.slice("company:".length).trim();
    if (companyId) {
      return { raw, type: "company", companyId };
    }
  }

  return { raw: "personal", type: "personal" };
}

export function isVehicleInWorkspace(
  vehicle: {
    user_id: string;
    owner_user_id: string | null;
    owner_company_id: string | null;
  },
  workspace: WorkspaceSelection,
  userId: string
) {
  if (workspace.type === "company") {
    return vehicle.owner_company_id === workspace.companyId;
  }

  if (vehicle.owner_company_id) return false;
  if (vehicle.owner_user_id) return vehicle.owner_user_id === userId;
  return vehicle.user_id === userId;
}
