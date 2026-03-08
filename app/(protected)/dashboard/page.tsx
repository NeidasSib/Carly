"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";

type DashboardData = {
  kpis: {
    total_vehicles: number;
    active_assignments_now: number;
    available_now: number;
    expiring_30_days: number;
    overdue_compliance: number;
  };
  urgent_compliance: Array<{
    vehicle_id: string;
    vehicle_name: string;
    vehicle_license_plate: string;
    type: "insurance" | "inspection" | "road_tax";
    due_at: string;
    is_overdue: boolean;
  }>;
  today_assignments: Array<{
    id: string;
    vehicle_id: string;
    vehicle_name: string;
    vehicle_model: string;
    vehicle_license_plate: string;
    assigned_to_user_id: string;
    assigned_to_name: string;
    start_at: string;
    end_at: string;
    status: string;
  }>;
  recent_vehicles: Array<{
    id: string;
    name: string;
    model: string;
    license_plate: string;
    updated_at: string;
  }>;
};

async function fetchDashboard(ws: string) {
  const params = new URLSearchParams();
  if (ws && ws !== "personal") {
    params.set("ws", ws);
  }
  const qs = params.toString();
  const res = await fetch(`/api/dashboard${qs ? `?${qs}` : ""}`);
  if (!res.ok) {
    let message = "Failed to load dashboard.";
    try {
      const body = await res.json();
      if (typeof body?.error === "string" && body.error.trim()) {
        message = body.error;
      }
    } catch {}
    throw new Error(message);
  }
  return (await res.json()) as { data: DashboardData };
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString();
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString();
}

function formatComplianceType(value: "insurance" | "inspection" | "road_tax") {
  switch (value) {
    case "road_tax":
      return "Road tax";
    case "inspection":
      return "Inspection";
    case "insurance":
    default:
      return "Insurance";
  }
}

export default function Page() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const workspace = searchParams.get("ws") ?? "personal";
  const [editingComplianceKey, setEditingComplianceKey] = useState<string | null>(null);
  const [nextDueDate, setNextDueDate] = useState("");
  const [updatingComplianceKey, setUpdatingComplianceKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard", workspace],
    queryFn: () => fetchDashboard(workspace),
    staleTime: 2 * 60 * 1000,
  });

  const dashboard = data?.data;

  async function updateComplianceDate(item: DashboardData["urgent_compliance"][number]) {
    if (!nextDueDate) return;
    setActionError(null);
    const key = `${item.vehicle_id}-${item.type}`;
    setUpdatingComplianceKey(key);
    try {
      const params = new URLSearchParams();
      if (workspace !== "personal") {
        params.set("ws", workspace);
      }
      const qs = params.toString();
      const res = await fetch(
        `/api/vehicles/${encodeURIComponent(item.vehicle_id)}/compliance${qs ? `?${qs}` : ""}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: item.type,
            due_at: nextDueDate,
          }),
        }
      );
      if (!res.ok) {
        let message = "Failed to update compliance date.";
        try {
          const body = await res.json();
          if (typeof body?.error === "string" && body.error.trim()) {
            message = body.error;
          }
        } catch {}
        setActionError(message);
        return;
      }
      setEditingComplianceKey(null);
      setNextDueDate("");
      await queryClient.invalidateQueries({ queryKey: ["dashboard", workspace] });
    } catch {
      setActionError("Failed to update compliance date.");
    } finally {
      setUpdatingComplianceKey(null);
    }
  }

  return (
    <div className="grid gap-4 p-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total vehicles</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {isLoading ? "-" : dashboard?.kpis.total_vehicles ?? 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active now</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {isLoading ? "-" : dashboard?.kpis.active_assignments_now ?? 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Available now</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {isLoading ? "-" : dashboard?.kpis.available_now ?? 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Expiring in 30 days</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {isLoading ? "-" : dashboard?.kpis.expiring_30_days ?? 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Overdue compliance</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {isLoading ? "-" : dashboard?.kpis.overdue_compliance ?? 0}
            </p>
          </CardContent>
        </Card>
      </div>

      {error ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">
              {error instanceof Error ? error.message : "Failed to load dashboard."}
            </p>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Urgent compliance</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {actionError ? (
              <p className="text-sm text-destructive">{actionError}</p>
            ) : null}
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : dashboard?.urgent_compliance.length ? (
              dashboard.urgent_compliance.map((item) => (
                <div
                  key={`${item.vehicle_id}-${item.type}-${item.due_at}`}
                  className="rounded-md border p-2 text-sm"
                >
                  <p className="font-medium">
                    {item.vehicle_name} ({item.vehicle_license_plate})
                  </p>
                  <p className="text-muted-foreground">
                    {formatComplianceType(item.type)} - due {formatDate(item.due_at)}
                    {item.is_overdue ? " (overdue)" : ""}
                  </p>
                  {editingComplianceKey === `${item.vehicle_id}-${item.type}` ? (
                    <div className="mt-2 flex items-center gap-2">
                      <DatePicker
                        value={nextDueDate}
                        onChange={setNextDueDate}
                        placeholder="Pick next due date"
                        className="max-w-[180px]"
                      />
                      <Button
                        type="button"
                        size="sm"
                        disabled={
                          !nextDueDate ||
                          updatingComplianceKey === `${item.vehicle_id}-${item.type}`
                        }
                        onClick={() => void updateComplianceDate(item)}
                      >
                        {updatingComplianceKey === `${item.vehicle_id}-${item.type}`
                          ? "Saving..."
                          : "Save"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={updatingComplianceKey === `${item.vehicle_id}-${item.type}`}
                        onClick={() => {
                          setEditingComplianceKey(null);
                          setNextDueDate("");
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <div className="mt-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setActionError(null);
                          setEditingComplianceKey(`${item.vehicle_id}-${item.type}`);
                          setNextDueDate(item.due_at.slice(0, 10));
                        }}
                      >
                        Update due date
                      </Button>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No urgent compliance items.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Today&apos;s assignments</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : dashboard?.today_assignments.length ? (
              dashboard.today_assignments.map((item) => (
                <div key={item.id} className="rounded-md border p-2 text-sm">
                  <p className="font-medium">
                    {item.vehicle_name} ({item.vehicle_license_plate})
                  </p>
                  <p className="text-muted-foreground">
                    {item.assigned_to_name} - {item.status}
                  </p>
                  <p className="text-muted-foreground">
                    {formatDateTime(item.start_at)} to {formatDateTime(item.end_at)}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No assignments today.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent vehicle updates</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : dashboard?.recent_vehicles.length ? (
            dashboard.recent_vehicles.map((vehicle) => (
              <div key={vehicle.id} className="rounded-md border p-2 text-sm">
                <p className="font-medium">
                  {vehicle.name} ({vehicle.license_plate})
                </p>
                <p className="text-muted-foreground">
                  Updated {formatDateTime(vehicle.updated_at)}
                </p>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No vehicles yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
