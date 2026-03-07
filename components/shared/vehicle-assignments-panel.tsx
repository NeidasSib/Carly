"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Assignment = {
  id: string;
  assigned_to_user_id: string;
  assigned_to_name: string;
  start_at: string;
  end_at: string;
  status: "scheduled" | "active" | "completed" | "cancelled";
  note: string | null;
  created_by: string;
};

type Member = {
  user_id: string;
  role: string;
  display_name: string;
};

type AssignmentsResponse = {
  data: Assignment[];
  members: Member[];
  currentUserId: string;
  currentUserRole: string;
};

type VehicleAssignmentsPanelProps = {
  vehicleId: string;
  workspace: string;
};

function toDatetimeLocalValue(date: Date) {
  const iso = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
  return iso;
}

async function fetchAssignments(vehicleId: string, workspace: string) {
  const params = new URLSearchParams({ ws: workspace });
  const res = await fetch(
    `/api/vehicles/${vehicleId}/assignments?${params.toString()}`
  );
  if (!res.ok) {
    throw new Error("Failed to fetch assignments.");
  }
  return (await res.json()) as AssignmentsResponse;
}

async function getResponseErrorMessage(res: Response) {
  try {
    const body = await res.json();
    if (typeof body?.error === "string" && body.error.trim()) {
      return body.error;
    }
    return `Request failed with status ${res.status}.`;
  } catch {
    return `Request failed with status ${res.status}.`;
  }
}

export default function VehicleAssignmentsPanel({
  vehicleId,
  workspace,
}: VehicleAssignmentsPanelProps) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdatingId, setIsUpdatingId] = useState<string | null>(null);

  const [form, setForm] = useState({
    assigned_to_user_id: "",
    start_at: toDatetimeLocalValue(new Date()),
    end_at: toDatetimeLocalValue(new Date(Date.now() + 2 * 60 * 60 * 1000)),
    note: "",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["vehicle-assignments", vehicleId, workspace],
    queryFn: () => fetchAssignments(vehicleId, workspace),
    staleTime: 30 * 1000,
  });

  const members = useMemo(() => data?.members ?? [], [data?.members]);
  const assignments = useMemo(() => data?.data ?? [], [data?.data]);
  const currentUserId = data?.currentUserId ?? "";
  const currentUserRole = data?.currentUserRole ?? "member";
  const isAdminOrOwner = currentUserRole === "owner" || currentUserRole === "admin";

  const selectableMembers = useMemo(() => {
    if (workspace.startsWith("company:")) return members;
    if (!currentUserId) return [];
    return [{ user_id: currentUserId, role: "owner", display_name: "You" }];
  }, [workspace, members, currentUserId]);

  const selectedAssignee = form.assigned_to_user_id || currentUserId;

  async function createAssignment(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsCreating(true);
    try {
      const params = new URLSearchParams({ ws: workspace });
      const res = await fetch(
        `/api/vehicles/${vehicleId}/assignments?${params.toString()}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            assigned_to_user_id: selectedAssignee,
            start_at: form.start_at,
            end_at: form.end_at,
            note: form.note.trim() || null,
          }),
        }
      );

      if (!res.ok) {
        setError(await getResponseErrorMessage(res));
        return;
      }

      setForm((prev) => ({ ...prev, note: "" }));
      await queryClient.invalidateQueries({
        queryKey: ["vehicle-assignments", vehicleId, workspace],
      });
    } catch {
      setError("Failed to create assignment.");
    } finally {
      setIsCreating(false);
    }
  }

  async function updateAssignmentStatus(
    assignmentId: string,
    status: "completed" | "cancelled"
  ) {
    setError(null);
    setIsUpdatingId(assignmentId);
    try {
      const params = new URLSearchParams({ ws: workspace });
      const res = await fetch(
        `/api/assignments/${assignmentId}?${params.toString()}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        }
      );
      if (!res.ok) {
        setError(await getResponseErrorMessage(res));
        return;
      }
      await queryClient.invalidateQueries({
        queryKey: ["vehicle-assignments", vehicleId, workspace],
      });
    } catch {
      setError("Failed to update assignment.");
    } finally {
      setIsUpdatingId(null);
    }
  }

  return (
    <div className="grid gap-4">
      <div className="rounded-md border p-4">
        <h3 className="mb-3 text-sm font-semibold">Assign vehicle</h3>
        <form onSubmit={createAssignment} className="grid gap-3">
          {workspace.startsWith("company:") ? (
            <div className="grid gap-2">
              <Label htmlFor="assignee">Assign to</Label>
              <Select
                value={selectedAssignee}
                onValueChange={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    assigned_to_user_id: value,
                  }))
                }
              >
                <SelectTrigger
                  id="assignee"
                  disabled={!isAdminOrOwner && selectableMembers.length > 0}
                >
                  <SelectValue placeholder="Select assignee" />
                </SelectTrigger>
                <SelectContent>
                  {(selectableMembers.length > 0
                    ? selectableMembers
                    : [
                        {
                          user_id: currentUserId,
                          role: currentUserRole,
                          display_name: "You",
                        },
                      ]
                  ).map((member) => (
                    <SelectItem key={member.user_id} value={member.user_id}>
                      {member.display_name}
                      {member.user_id === currentUserId ? " (you)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Start</Label>
              <DateTimePicker
                value={form.start_at}
                onChange={(value) =>
                  setForm((prev) => ({ ...prev, start_at: value }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>End</Label>
              <DateTimePicker
                value={form.end_at}
                onChange={(value) =>
                  setForm((prev) => ({ ...prev, end_at: value }))
                }
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="note">Note</Label>
            <Input
              id="note"
              value={form.note}
              onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))}
              placeholder="Optional note"
            />
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={isCreating}>
              {isCreating ? "Assigning..." : "Create assignment"}
            </Button>
          </div>
        </form>
      </div>

      <div className="rounded-md border p-4">
        <h3 className="mb-3 text-sm font-semibold">Assignments</h3>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading assignments...</p>
        ) : assignments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No assignments yet.</p>
        ) : (
          <div className="grid gap-3">
            {assignments.map((assignment) => {
              const canUpdate =
                isAdminOrOwner || assignment.assigned_to_user_id === currentUserId;
              const showActions =
                canUpdate &&
                (assignment.status === "scheduled" ||
                  assignment.status === "active");

              return (
                <div
                  key={assignment.id}
                  className="rounded-md border border-border/60 p-3 text-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">{assignment.assigned_to_name}</p>
                    <span className="rounded bg-muted px-2 py-0.5 text-xs capitalize">
                      {assignment.status}
                    </span>
                  </div>
                  <p className="mt-1 text-muted-foreground">
                    {new Date(assignment.start_at).toLocaleString()} -{" "}
                    {new Date(assignment.end_at).toLocaleString()}
                  </p>
                  {assignment.note ? (
                    <p className="mt-1 text-muted-foreground">{assignment.note}</p>
                  ) : null}
                  {showActions ? (
                    <div className="mt-3 flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={isUpdatingId === assignment.id}
                        onClick={() =>
                          updateAssignmentStatus(assignment.id, "completed")
                        }
                      >
                        Complete
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={isUpdatingId === assignment.id}
                        onClick={() =>
                          updateAssignmentStatus(assignment.id, "cancelled")
                        }
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
