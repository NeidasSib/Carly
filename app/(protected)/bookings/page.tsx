"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { DateTimePicker } from "@/components/ui/date-time-picker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type BookingPageData = {
  vehicles: Array<{
    id: string;
    name: string;
    model: string;
    license_plate: string;
  }>;
  members: Array<{
    user_id: string;
    role: "owner" | "admin" | "member";
    display_name: string;
  }>;
  bookings: Array<{
    id: string;
    vehicle_id: string;
    vehicle_name: string;
    vehicle_model: string;
    vehicle_license_plate: string;
    assigned_to_user_id: string;
    assigned_to_name: string;
    created_by: string;
    created_by_name: string;
    start_at: string;
    end_at: string;
    status: "scheduled" | "active" | "completed" | "cancelled";
    note: string | null;
  }>;
  currentUserId: string;
  currentUserRole: "owner" | "admin" | "member";
};

function toDatetimeLocalValue(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
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

async function fetchBookings(workspace: string) {
  const params = new URLSearchParams({ ws: workspace });
  const res = await fetch(`/api/bookings?${params.toString()}`);
  if (!res.ok) {
    throw new Error(await getResponseErrorMessage(res));
  }
  return (await res.json()) as { data: BookingPageData };
}

export default function BookingsPage() {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const workspace = searchParams.get("ws") ?? "personal";
  const isCompanyWorkspace = workspace.startsWith("company:");

  const { data, isLoading, error } = useQuery({
    queryKey: ["bookings-page", workspace],
    queryFn: () => fetchBookings(workspace),
    enabled: isCompanyWorkspace,
  });

  const payload = data?.data;
  const members = useMemo(() => payload?.members ?? [], [payload?.members]);
  const vehicles = useMemo(() => payload?.vehicles ?? [], [payload?.vehicles]);
  const bookings = useMemo(() => payload?.bookings ?? [], [payload?.bookings]);
  const currentUserId = payload?.currentUserId ?? "";
  const currentUserRole = payload?.currentUserRole ?? "member";
  const isAdminOrOwner = currentUserRole === "owner" || currentUserRole === "admin";

  const [form, setForm] = useState({
    vehicle_id: "",
    assigned_to_user_id: "",
    start_at: toDatetimeLocalValue(new Date()),
    end_at: toDatetimeLocalValue(new Date(Date.now() + 2 * 60 * 60 * 1000)),
    note: "",
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdatingId, setIsUpdatingId] = useState<string | null>(null);

  const selectableMembers = useMemo(() => {
    if (!isCompanyWorkspace) return [];
    if (isAdminOrOwner) return members;
    return members.filter((member) => member.user_id === currentUserId);
  }, [isCompanyWorkspace, isAdminOrOwner, members, currentUserId]);

  const effectiveAssigneeId = form.assigned_to_user_id || currentUserId;

  async function createBooking(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    const startAt = new Date(form.start_at);
    const endAt = new Date(form.end_at);
    if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
      setErrorMessage("Start and end must be valid.");
      return;
    }
    if (endAt <= startAt) {
      setErrorMessage("End time must be after start time.");
      return;
    }
    if (!form.vehicle_id) {
      setErrorMessage("Select a vehicle.");
      return;
    }
    if (!effectiveAssigneeId) {
      setErrorMessage("Select an assignee.");
      return;
    }

    setIsCreating(true);
    try {
      const params = new URLSearchParams({ ws: workspace });
      const res = await fetch(`/api/bookings?${params.toString()}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicle_id: form.vehicle_id,
          assigned_to_user_id: effectiveAssigneeId,
          start_at: form.start_at,
          end_at: form.end_at,
          note: form.note.trim() || null,
        }),
      });
      if (!res.ok) {
        setErrorMessage(await getResponseErrorMessage(res));
        return;
      }

      setForm((prev) => ({ ...prev, note: "" }));
      await queryClient.invalidateQueries({ queryKey: ["bookings-page", workspace] });
      await queryClient.invalidateQueries({ queryKey: ["calendar-page"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard", workspace] });
    } catch {
      setErrorMessage("Failed to create booking.");
    } finally {
      setIsCreating(false);
    }
  }

  async function updateBookingStatus(
    bookingId: string,
    status: "completed" | "cancelled"
  ) {
    setErrorMessage(null);
    setIsUpdatingId(bookingId);
    try {
      const params = new URLSearchParams({ ws: workspace });
      const res = await fetch(`/api/assignments/${bookingId}?${params.toString()}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        setErrorMessage(await getResponseErrorMessage(res));
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["bookings-page", workspace] });
      await queryClient.invalidateQueries({ queryKey: ["calendar-page"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard", workspace] });
    } catch {
      setErrorMessage("Failed to update booking.");
    } finally {
      setIsUpdatingId(null);
    }
  }

  if (!isCompanyWorkspace) {
    return (
      <div className="grid gap-4 p-4">
        <Card>
          <CardHeader>
            <CardTitle>Bookings</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Switch to a company workspace to create and manage bookings.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid gap-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle>Create booking</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3" onSubmit={createBooking}>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Vehicle</Label>
                <Select
                  value={form.vehicle_id}
                  onValueChange={(value) =>
                    setForm((prev) => ({ ...prev, vehicle_id: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select vehicle" />
                  </SelectTrigger>
                  <SelectContent>
                    {vehicles.map((vehicle) => (
                      <SelectItem key={vehicle.id} value={vehicle.id}>
                        {vehicle.name} ({vehicle.license_plate})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Assign to</Label>
                <Select
                  value={effectiveAssigneeId}
                  onValueChange={(value) =>
                    setForm((prev) => ({ ...prev, assigned_to_user_id: value }))
                  }
                  disabled={!isAdminOrOwner}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select assignee" />
                  </SelectTrigger>
                  <SelectContent>
                    {(selectableMembers.length ? selectableMembers : members).map((member) => (
                      <SelectItem key={member.user_id} value={member.user_id}>
                        {member.display_name}
                        {member.user_id === currentUserId ? " (you)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Start</Label>
                <DateTimePicker
                  value={form.start_at}
                  onChange={(value) => setForm((prev) => ({ ...prev, start_at: value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label>End</Label>
                <DateTimePicker
                  value={form.end_at}
                  onChange={(value) => setForm((prev) => ({ ...prev, end_at: value }))}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="booking-note">Note</Label>
              <Input
                id="booking-note"
                placeholder="Optional note"
                value={form.note}
                onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))}
              />
            </div>

            {errorMessage ? (
              <p className="text-sm text-destructive">{errorMessage}</p>
            ) : null}

            <div className="flex justify-end">
              <Button type="submit" disabled={isCreating}>
                {isCreating ? "Creating..." : "Create booking"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bookings</CardTitle>
        </CardHeader>
        <CardContent>
          {error ? (
            <p className="text-sm text-destructive">
              {error instanceof Error ? error.message : "Failed to load bookings."}
            </p>
          ) : null}
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading bookings...</p>
          ) : bookings.length === 0 ? (
            <p className="text-sm text-muted-foreground">No bookings yet.</p>
          ) : (
            <div className="grid gap-3">
              {bookings.map((booking) => {
                const canUpdate =
                  isAdminOrOwner || booking.assigned_to_user_id === currentUserId;
                const showActions =
                  canUpdate &&
                  (booking.status === "scheduled" || booking.status === "active");

                return (
                  <div key={booking.id} className="rounded-md border p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium">
                        {booking.vehicle_name} ({booking.vehicle_license_plate})
                      </p>
                      <span className="rounded bg-muted px-2 py-0.5 text-xs capitalize">
                        {booking.status}
                      </span>
                    </div>
                    <p className="mt-1 text-muted-foreground">
                      Assigned to: {booking.assigned_to_name}
                    </p>
                    <p className="text-muted-foreground">
                      {new Date(booking.start_at).toLocaleString()} -{" "}
                      {new Date(booking.end_at).toLocaleString()}
                    </p>
                    {booking.note ? (
                      <p className="mt-1 text-muted-foreground">{booking.note}</p>
                    ) : null}
                    {showActions ? (
                      <div className="mt-3 flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={isUpdatingId === booking.id}
                          onClick={() => updateBookingStatus(booking.id, "completed")}
                        >
                          Complete
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={isUpdatingId === booking.id}
                          onClick={() => updateBookingStatus(booking.id, "cancelled")}
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
        </CardContent>
      </Card>
    </div>
  );
}
