import { NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { parseWorkspaceParam } from "@/lib/workspace";

type ComplianceType = "insurance" | "inspection" | "road_tax";

function getOwnershipWhere(workspace: ReturnType<typeof parseWorkspaceParam>, userId: string) {
  return workspace.type === "company"
    ? {
        owner_company_id: workspace.companyId,
      }
    : {
        OR: [
          {
            owner_user_id: userId,
            owner_company_id: null,
          },
          {
            owner_user_id: null,
            owner_company_id: null,
            user_id: userId,
          },
        ],
      };
}

function parseYmd(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

function toYmd(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function minDate(a: Date, b: Date) {
  return a.getTime() <= b.getTime() ? a : b;
}

function maxDate(a: Date, b: Date) {
  return a.getTime() >= b.getTime() ? a : b;
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const workspace = parseWorkspaceParam(searchParams.get("ws"));
  const startParam = (searchParams.get("start") ?? "").trim();
  const endParam = (searchParams.get("end") ?? "").trim();

  if (!startParam || !endParam) {
    return NextResponse.json(
      { error: "start and end date are required (yyyy-mm-dd)." },
      { status: 400 }
    );
  }

  const start = parseYmd(startParam);
  const end = parseYmd(endParam);
  if (!start || !end || start > end) {
    return NextResponse.json({ error: "Invalid date range." }, { status: 400 });
  }

  const daySpan = Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  if (daySpan > 93) {
    return NextResponse.json({ error: "Date range too large." }, { status: 400 });
  }

  if (workspace.type === "company") {
    const membership = await prisma.companyMember.findFirst({
      where: {
        company_id: workspace.companyId,
        user_id: user.id,
      },
    });
    if (!membership) {
      return NextResponse.json(
        { error: "You do not have access to this company workspace." },
        { status: 403 }
      );
    }
  }

  const ownershipWhere = getOwnershipWhere(workspace, user.id);
  const endExclusive = addDays(end, 1);

  const [bookings, complianceVehicles] = await Promise.all([
    prisma.vehicleAssignment.findMany({
      where: {
        vehicle: ownershipWhere,
        start_at: {
          lt: endExclusive,
        },
        end_at: {
          gte: start,
        },
      },
      select: {
        id: true,
        vehicle_id: true,
        start_at: true,
        end_at: true,
        status: true,
        assigned_to_user_id: true,
        vehicle: {
          select: {
            name: true,
            model: true,
            license_plate: true,
          },
        },
      },
      orderBy: { start_at: "asc" },
    }),
    prisma.vehicle.findMany({
      where: {
        AND: [
          ownershipWhere,
          {
            OR: [
              { insurance_valid_until: { gte: start, lt: endExclusive } },
              { inspection_valid_until: { gte: start, lt: endExclusive } },
              { road_tax_valid_until: { gte: start, lt: endExclusive } },
            ],
          },
        ],
      },
      select: {
        id: true,
        name: true,
        license_plate: true,
        insurance_valid_until: true,
        inspection_valid_until: true,
        road_tax_valid_until: true,
      },
    }),
  ]);

  const assigneeIds = Array.from(new Set(bookings.map((booking) => booking.assigned_to_user_id)));
  const profiles = assigneeIds.length
    ? await prisma.profile.findMany({
        where: {
          id: {
            in: assigneeIds,
          },
        },
        select: {
          id: true,
          display_name: true,
        },
      })
    : [];

  const profileById = new Map(profiles.map((profile) => [profile.id, profile.display_name]));
  const daySummary = new Map<string, { bookings: number; compliance: number }>();

  for (const booking of bookings) {
    const bookingStartDay = new Date(booking.start_at);
    bookingStartDay.setHours(0, 0, 0, 0);
    const bookingEndDay = new Date(booking.end_at);
    bookingEndDay.setHours(0, 0, 0, 0);
    const effectiveStart = maxDate(start, bookingStartDay);
    const effectiveEnd = minDate(end, bookingEndDay);

    for (
      let current = new Date(effectiveStart);
      current <= effectiveEnd;
      current = addDays(current, 1)
    ) {
      const key = toYmd(current);
      const existing = daySummary.get(key) ?? { bookings: 0, compliance: 0 };
      existing.bookings += 1;
      daySummary.set(key, existing);
    }
  }

  const complianceItems: Array<{
    vehicle_id: string;
    vehicle_name: string;
    vehicle_license_plate: string;
    due_at: string;
    type: ComplianceType;
  }> = [];
  for (const vehicle of complianceVehicles) {
    const checks: Array<{ type: ComplianceType; dueAt: Date | null }> = [
      { type: "insurance", dueAt: vehicle.insurance_valid_until },
      { type: "inspection", dueAt: vehicle.inspection_valid_until },
      { type: "road_tax", dueAt: vehicle.road_tax_valid_until },
    ];
    for (const check of checks) {
      if (!check.dueAt) continue;
      if (check.dueAt < start || check.dueAt >= endExclusive) continue;
      complianceItems.push({
        vehicle_id: vehicle.id,
        vehicle_name: vehicle.name,
        vehicle_license_plate: vehicle.license_plate,
        due_at: check.dueAt.toISOString(),
        type: check.type,
      });
      const key = toYmd(check.dueAt);
      const existing = daySummary.get(key) ?? { bookings: 0, compliance: 0 };
      existing.compliance += 1;
      daySummary.set(key, existing);
    }
  }

  const payloadSummary: Record<string, { bookings: number; compliance: number }> = {};
  for (const [key, value] of daySummary.entries()) {
    payloadSummary[key] = value;
  }

  return NextResponse.json({
    data: {
      range: {
        start: toYmd(start),
        end: toYmd(end),
      },
      day_summary: payloadSummary,
      bookings: bookings.map((booking) => ({
        id: booking.id,
        vehicle_id: booking.vehicle_id,
        vehicle_name: booking.vehicle.name,
        vehicle_model: booking.vehicle.model,
        vehicle_license_plate: booking.vehicle.license_plate,
        assigned_to_user_id: booking.assigned_to_user_id,
        assigned_to_name:
          profileById.get(booking.assigned_to_user_id) ??
          (booking.assigned_to_user_id === user.id ? "You" : "Member"),
        status: booking.status,
        start_at: booking.start_at.toISOString(),
        end_at: booking.end_at.toISOString(),
      })),
      compliance: complianceItems,
    },
  });
}
