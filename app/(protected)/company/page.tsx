"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Company = {
  id: string;
  name: string;
  role: "owner" | "admin" | "member";
};

type CompanyMember = {
  id: string;
  company_id: string;
  user_id: string;
  display_name: string;
  role: "owner" | "admin" | "member";
};

type CompanyInvite = {
  id: string;
  company_id: string;
  role: "owner" | "admin" | "member";
  expires_at: string;
  created_at: string;
};

async function getResponseErrorMessage(res: Response) {
  try {
    const data = await res.json();
    if (typeof data?.error === "string" && data.error.trim()) {
      return data.error;
    }
    return `Request failed with status ${res.status}.`;
  } catch {
    return `Request failed with status ${res.status}.`;
  }
}

async function fetchCompanies() {
  const res = await fetch("/api/companies");
  if (!res.ok) throw new Error("Failed to load companies.");
  return (await res.json()) as { data: Company[] };
}

async function fetchMembers(companyId: string) {
  const res = await fetch(`/api/companies/${companyId}/members`);
  if (!res.ok) throw new Error("Failed to load members.");
  return (await res.json()) as {
    data: CompanyMember[];
    currentUserRole: string;
    currentUserId: string;
  };
}

async function fetchInvites(companyId: string) {
  const res = await fetch(`/api/companies/${companyId}/invites`);
  if (!res.ok) throw new Error("Failed to load invites.");
  return (await res.json()) as { data: CompanyInvite[] };
}

export default function ManageCompanyPage() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const workspace = searchParams.get("ws") ?? "personal";
  const companyId = workspace.startsWith("company:")
    ? workspace.slice("company:".length)
    : null;

  const [inviteRole, setInviteRole] = useState<"owner" | "admin" | "member">(
    "member"
  );
  const [generatedInviteLink, setGeneratedInviteLink] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const { data: companiesData } = useQuery({
    queryKey: ["companies"],
    queryFn: fetchCompanies,
  });

  const { data: membersData } = useQuery({
    queryKey: ["company-members", companyId],
    queryFn: () => fetchMembers(companyId as string),
    enabled: Boolean(companyId),
  });

  const { data: invitesData } = useQuery({
    queryKey: ["company-invites", companyId],
    queryFn: () => fetchInvites(companyId as string),
    enabled: Boolean(companyId),
  });

  const companies = companiesData?.data ?? [];
  const members = membersData?.data ?? [];
  const invites = invitesData?.data ?? [];
  const currentRole = membersData?.currentUserRole ?? "member";
  const currentUserId = membersData?.currentUserId ?? "";
  const canManageMembers = currentRole === "owner" || currentRole === "admin";

  const activeCompany = companies.find((company) => company.id === companyId) ?? null;

  async function createInvite() {
    if (!companyId) return;
    setError(null);
    setBusyAction("create-invite");
    try {
      const res = await fetch(`/api/companies/${companyId}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: inviteRole,
        }),
      });
      if (!res.ok) {
        setError(await getResponseErrorMessage(res));
        return;
      }
      const data = (await res.json()) as {
        data: CompanyInvite & { invite_link: string };
      };
      setGeneratedInviteLink(data.data.invite_link);
      await queryClient.invalidateQueries({
        queryKey: ["company-invites", companyId],
      });
      await queryClient.invalidateQueries({
        queryKey: ["company-members", companyId],
      });
      await queryClient.invalidateQueries({ queryKey: ["companies"] });
      await queryClient.invalidateQueries({ queryKey: ["workspaces"] });
    } catch {
      setError("Failed to create invite.");
    } finally {
      setBusyAction(null);
    }
  }

  async function revokeInvite(inviteId: string) {
    if (!companyId) return;
    setError(null);
    setBusyAction(`revoke-${inviteId}`);
    try {
      const res = await fetch(
        `/api/companies/${companyId}/invites/${encodeURIComponent(inviteId)}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        setError(await getResponseErrorMessage(res));
        return;
      }
      await queryClient.invalidateQueries({
        queryKey: ["company-invites", companyId],
      });
    } catch {
      setError("Failed to revoke invite.");
    } finally {
      setBusyAction(null);
    }
  }

  async function copyInviteLink() {
    if (!generatedInviteLink) return;
    try {
      await navigator.clipboard.writeText(generatedInviteLink);
    } catch {
      setError("Failed to copy invite link.");
    }
  }

  async function removeMember(targetUserId: string) {
    if (!companyId) return;
    setError(null);
    setBusyAction(`remove-${targetUserId}`);
    try {
      const res = await fetch(
        `/api/companies/${companyId}/members/${encodeURIComponent(targetUserId)}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        setError(await getResponseErrorMessage(res));
        return;
      }
      await queryClient.invalidateQueries({
        queryKey: ["company-members", companyId],
      });
      await queryClient.invalidateQueries({ queryKey: ["companies"] });
      await queryClient.invalidateQueries({ queryKey: ["workspaces"] });
    } catch {
      setError("Failed to remove member.");
    } finally {
      setBusyAction(null);
    }
  }

  async function deleteCompany() {
    if (!companyId) return;
    setError(null);
    setBusyAction("delete-company");
    try {
      const res = await fetch(`/api/companies/${companyId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        setError(await getResponseErrorMessage(res));
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["company-members", companyId] });
      await queryClient.invalidateQueries({ queryKey: ["companies"] });
      await queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      window.location.href = "/dashboard";
    } catch {
      setError("Failed to delete company.");
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <div className="grid gap-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle>
            Manage Company
            {activeCompany ? `: ${activeCompany.name}` : ""}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          {!companyId ? (
            <p className="text-sm text-muted-foreground">
              Switch to a company workspace from the sidebar to manage members.
            </p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Your role: <span className="capitalize">{currentRole}</span>
              </p>

              <div className="grid gap-3 md:grid-cols-[180px_auto]">
                <div className="grid gap-2">
                  <Label>Invite role</Label>
                  <Select
                    value={inviteRole}
                    onValueChange={(value) =>
                      setInviteRole(value as "owner" | "admin" | "member")
                    }
                    disabled={!canManageMembers}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="member">member</SelectItem>
                      <SelectItem value="admin">admin</SelectItem>
                      <SelectItem value="owner">owner</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button
                    type="button"
                    disabled={!canManageMembers || busyAction === "create-invite"}
                    onClick={createInvite}
                  >
                    {busyAction === "create-invite"
                      ? "Creating..."
                      : "Create one-time invite link"}
                  </Button>
                </div>
              </div>

              {generatedInviteLink ? (
                <div className="grid gap-2 rounded-md border p-3">
                  <Label htmlFor="generated-invite-link">Latest invite link</Label>
                  <div className="flex gap-2">
                    <Input
                      id="generated-invite-link"
                      value={generatedInviteLink}
                      readOnly
                    />
                    <Button type="button" variant="outline" onClick={copyInviteLink}>
                      Copy
                    </Button>
                  </div>
                </div>
              ) : null}

              <div className="grid gap-2 text-sm">
                <p className="font-medium">Active invite links</p>
                {invites.length === 0 ? (
                  <p className="text-muted-foreground">No active invite links.</p>
                ) : (
                  invites.map((invite) => (
                    <div
                      key={invite.id}
                      className="flex items-center justify-between rounded-md border p-2"
                    >
                      <div>
                        <p className="capitalize">{invite.role}</p>
                        <p className="text-xs text-muted-foreground">
                          Expires {new Date(invite.expires_at).toLocaleString()}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={
                          !canManageMembers || busyAction === `revoke-${invite.id}`
                        }
                        onClick={() => revokeInvite(invite.id)}
                      >
                        Revoke
                      </Button>
                    </div>
                  ))
                )}
              </div>

              <div className="grid gap-2 text-sm">
                {members.length === 0 ? (
                  <p className="text-muted-foreground">No members.</p>
                ) : (
                  members.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between rounded-md border p-2"
                    >
                      <div>
                        <p>{member.display_name}</p>
                        <p className="text-xs capitalize text-muted-foreground">
                          {member.role}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={
                          member.user_id === currentUserId ||
                          !canManageMembers ||
                          busyAction === `remove-${member.user_id}`
                        }
                        onClick={() => removeMember(member.user_id)}
                      >
                        Remove
                      </Button>
                    </div>
                  ))
                )}
              </div>

              {currentRole === "owner" ? (
                <div className="pt-2">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive">
                        Delete company
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete company?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action is permanent. Company members will lose access
                          and company vehicles will be moved to your personal
                          workspace.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel disabled={busyAction === "delete-company"}>
                          Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                          disabled={busyAction === "delete-company"}
                          onClick={async (e) => {
                            e.preventDefault();
                            await deleteCompany();
                          }}
                        >
                          {busyAction === "delete-company"
                            ? "Deleting..."
                            : "Delete company"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              ) : null}
            </>
          )}

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
