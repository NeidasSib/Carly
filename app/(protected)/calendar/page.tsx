"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";

type CalendarPayload = {
  range: {
    start: string;
    end: string;
  };
  day_summary: Record<
    string,
    {
      bookings: number;
      compliance: number;
    }
  >;
  bookings: Array<{
    id: string;
    vehicle_id: string;
    vehicle_name: string;
    vehicle_model: string;
    vehicle_license_plate: string;
    assigned_to_user_id: string;
    assigned_to_name: string;
    status: string;
    start_at: string;
    end_at: string;
  }>;
  compliance: Array<{
    vehicle_id: string;
    vehicle_name: string;
    vehicle_license_plate: string;
    due_at: string;
    type: "insurance" | "inspection" | "road_tax";
  }>;
};

function toYmd(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getMonthRange(monthDate: Date) {
  const start = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const end = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
  return { start, end };
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString();
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

async function fetchCalendarData(ws: string, monthDate: Date) {
  const range = getMonthRange(monthDate);
  const params = new URLSearchParams({
    start: toYmd(range.start),
    end: toYmd(range.end),
  });
  if (ws !== "personal") {
    params.set("ws", ws);
  }

  const res = await fetch(`/api/calendar?${params.toString()}`);
  if (!res.ok) {
    let message = "Failed to load calendar.";
    try {
      const body = await res.json();
      if (typeof body?.error === "string" && body.error.trim()) {
        message = body.error;
      }
    } catch {}
    throw new Error(message);
  }
  return (await res.json()) as { data: CalendarPayload };
}

function bookingOverlapsDate(startAt: string, endAt: string, targetDate: Date) {
  const start = new Date(startAt);
  const end = new Date(endAt);
  const dayStart = new Date(targetDate);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);
  return start < dayEnd && end >= dayStart;
}

export default function CalendarPage() {
  const searchParams = useSearchParams();
  const workspace = searchParams.get("ws") ?? "personal";
  const [monthDate, setMonthDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, "0")}`;
  const { data, isLoading, error } = useQuery({
    queryKey: ["calendar-page", workspace, monthKey],
    queryFn: () => fetchCalendarData(workspace, monthDate),
  });

  const payload = data?.data;
  const bookingDates = useMemo(() => {
    if (!payload) return [];
    return Object.entries(payload.day_summary)
      .filter(([, summary]) => summary.bookings > 0)
      .map(([key]) => new Date(`${key}T00:00:00`));
  }, [payload]);
  const complianceDates = useMemo(() => {
    if (!payload) return [];
    return Object.entries(payload.day_summary)
      .filter(([, summary]) => summary.compliance > 0)
      .map(([key]) => new Date(`${key}T00:00:00`));
  }, [payload]);

  const selectedKey = selectedDate ? toYmd(selectedDate) : "";
  const selectedSummary = selectedKey ? payload?.day_summary[selectedKey] : undefined;
  const selectedBookings =
    selectedDate && payload
      ? payload.bookings.filter((booking) =>
          bookingOverlapsDate(booking.start_at, booking.end_at, selectedDate)
        )
      : [];
  const selectedCompliance =
    selectedDate && payload
      ? payload.compliance.filter((item) => toYmd(new Date(item.due_at)) === selectedKey)
      : [];

  return (
    <div className="grid gap-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle>Calendar</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 xl:grid-cols-[1fr_360px]">
          <div className="rounded-md border p-2">
            <div className="-mx-2 overflow-x-auto px-2 [-webkit-overflow-scrolling:touch]">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                month={monthDate}
                onMonthChange={setMonthDate}
                className="mx-auto min-w-[20.5rem] [--cell-size:2.55rem] sm:min-w-[22rem] sm:[--cell-size:2.8rem] md:min-w-0 md:[--cell-size:3.2rem]"
                modifiers={{
                  hasBookings: bookingDates,
                  hasCompliance: complianceDates,
                }}
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-blue-500/60" />
                Booking days
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-amber-500/60" />
                Compliance due
              </span>
            </div>
          </div>

          <div className="grid gap-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {selectedDate ? selectedDate.toLocaleDateString() : "Select a day"}
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2 text-sm">
                {error ? (
                  <p className="text-destructive">
                    {error instanceof Error ? error.message : "Failed to load calendar."}
                  </p>
                ) : null}
                {isLoading ? <p className="text-muted-foreground">Loading...</p> : null}
                {!isLoading && !error ? (
                  <>
                    <p className="text-muted-foreground">
                      Tags:{" "}
                      {selectedSummary
                        ? `${selectedSummary.bookings} booking(s), ${selectedSummary.compliance} compliance due`
                        : "No tags"}
                    </p>
                    <div className="grid gap-2">
                      <p className="font-medium">Bookings</p>
                      {selectedBookings.length === 0 ? (
                        <p className="text-muted-foreground">No bookings.</p>
                      ) : (
                        selectedBookings.map((booking) => (
                          <div key={booking.id} className="rounded-md border p-2">
                            <p className="font-medium">
                              {booking.vehicle_name} ({booking.vehicle_license_plate})
                            </p>
                            <p className="text-muted-foreground">
                              {booking.assigned_to_name} - {booking.status}
                            </p>
                            <p className="text-muted-foreground">
                              {formatDateTime(booking.start_at)} to{" "}
                              {formatDateTime(booking.end_at)}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                    <div className="grid gap-2">
                      <p className="font-medium">Compliance due</p>
                      {selectedCompliance.length === 0 ? (
                        <p className="text-muted-foreground">No compliance due.</p>
                      ) : (
                        selectedCompliance.map((item) => (
                          <div
                            key={`${item.vehicle_id}-${item.type}-${item.due_at}`}
                            className="rounded-md border p-2"
                          >
                            <p className="font-medium">
                              {item.vehicle_name} ({item.vehicle_license_plate})
                            </p>
                            <p className="text-muted-foreground">
                              {formatComplianceType(item.type)}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
