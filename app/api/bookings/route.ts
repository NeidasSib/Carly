import { NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { parseWorkspaceParam } from "@/lib/workspace";

function parseDate(value: unknown) {
  const parsed = new Date(String(value ?? ""));
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed;
}

function overlapsRange(
  startAt: Date,
  endAt: Date,
  existingStartAt: Date,
  existingEndAt: Date
) {
  return startAt < existingEndAt && endAt > existingStartAt;
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspace = parseWorkspaceParam(new URL(request.url).searchParams.get("ws"));
  if (workspace.type !== "company") {
    return NextResponse.json(
      { error: "Bookings page is available only in company workspaces." },
      { status: 400 }
    );
  }

  const membership = await prisma.companyMember.findFirst({
    where: {
      company_id: workspace.companyId,
      user_id: user.id,
    },
    select: {
      role: true,
    },
  });
  if (!membership) {
    return NextResponse.json(
      { error: "You do not have access to this company workspace." },
      { status: 403 }
    );
  }

  const [vehicles, membersRaw, bookingsRaw] = await Promise.all([
    prisma.vehicle.findMany({
      where: {
        owner_company_id: workspace.companyId,
      },
      select: {
        id: true,
        name: true,
        model: true,
        license_plate: true,
      },
      orderBy: {
        created_at: "desc",
      },
    }),
    prisma.companyMember.findMany({
      where: {
        company_id: workspace.companyId,
      },
      select: {
        user_id: true,
        role: true,
      },
      orderBy: {
        created_at: "asc",
      },
    }),
    prisma.vehicleAssignment.findMany({
      where: {
        vehicle: {
          owner_company_id: workspace.companyId,
        },
      },
      include: {
        vehicle: {
          select: {
            id: true,
            name: true,
            model: true,
            license_plate: true,
          },
        },
      },
      orderBy: {
        start_at: "desc",
      },
      take: 100,
    }),
  ]);

  const profileIds = Array.from(
    new Set([
      ...membersRaw.map((member) => member.user_id),
      ...bookingsRaw.map((booking) => booking.assigned_to_user_id),
      ...bookingsRaw.map((booking) => booking.created_by),
    ])
  );

  const profiles = profileIds.length
    ? await prisma.profile.findMany({
        where: {
          id: {
            in: profileIds,
          },
        },
        select: {
          id: true,
          display_name: true,
        },
      })
    : [];
  const profileById = new Map(profiles.map((profile) => [profile.id, profile.display_name]));

  return NextResponse.json({
    data: {
      vehicles,
      members: membersRaw.map((member) => ({
        ...member,
        display_name:
          profileById.get(member.user_id) ??
          (member.user_id === user.id ? "You" : "Member"),
      })),
      bookings: bookingsRaw.map((booking) => ({
        id: booking.id,
        vehicle_id: booking.vehicle_id,
        vehicle_name: booking.vehicle.name,
        vehicle_model: booking.vehicle.model,
        vehicle_license_plate: booking.vehicle.license_plate,
        assigned_to_user_id: booking.assigned_to_user_id,
        assigned_to_name:
          profileById.get(booking.assigned_to_user_id) ??
          (booking.assigned_to_user_id === user.id ? "You" : "Member"),
        created_by: booking.created_by,
        created_by_name:
          profileById.get(booking.created_by) ??
          (booking.created_by === user.id ? "You" : "Member"),
        start_at: booking.start_at,
        end_at: booking.end_at,
        status: booking.status,
        note: booking.note,
      })),
      currentUserId: user.id,
      currentUserRole: membership.role,
    },
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspace = parseWorkspaceParam(new URL(request.url).searchParams.get("ws"));
  if (workspace.type !== "company") {
    return NextResponse.json(
      { error: "Bookings page is available only in company workspaces." },
      { status: 400 }
    );
  }

  const membership = await prisma.companyMember.findFirst({
    where: {
      company_id: workspace.companyId,
      user_id: user.id,
    },
    select: {
      role: true,
    },
  });
  if (!membership) {
    return NextResponse.json(
      { error: "You do not have access to this company workspace." },
      { status: 403 }
    );
  }

  const body = await request.json();
  const vehicleId = String(body.vehicle_id ?? "").trim();
  const assignedToUserId = String(body.assigned_to_user_id ?? user.id).trim();
  const startAt = parseDate(body.start_at);
  const endAt = parseDate(body.end_at);
  const note = typeof body.note === "string" ? body.note.trim() || null : null;

  if (!vehicleId || !assignedToUserId || !startAt || !endAt) {
    return NextResponse.json(
      { error: "Vehicle, assignee, start, and end are required." },
      { status: 400 }
    );
  }
  if (endAt <= startAt) {
    return NextResponse.json(
      { error: "End time must be after start time." },
      { status: 400 }
    );
  }

  const vehicle = await prisma.vehicle.findFirst({
    where: {
      id: vehicleId,
      owner_company_id: workspace.companyId,
    },
    select: {
      id: true,
    },
  });
  if (!vehicle) {
    return NextResponse.json({ error: "Vehicle not found." }, { status: 404 });
  }

  const targetMember = await prisma.companyMember.findFirst({
    where: {
      company_id: workspace.companyId,
      user_id: assignedToUserId,
    },
    select: {
      user_id: true,
    },
  });
  if (!targetMember) {
    return NextResponse.json(
      { error: "Assigned user is not a member of this company." },
      { status: 400 }
    );
  }

  const isAdminOrOwner = membership.role === "owner" || membership.role === "admin";
  if (!isAdminOrOwner && assignedToUserId !== user.id) {
    return NextResponse.json(
      { error: "Only admins can book vehicles for other members." },
      { status: 403 }
    );
  }

  const existing = await prisma.vehicleAssignment.findMany({
    where: {
      vehicle_id: vehicleId,
      status: {
        in: ["scheduled", "active"],
      },
    },
    select: {
      start_at: true,
      end_at: true,
    },
  });

  const hasOverlap = existing.some((item) =>
    overlapsRange(startAt, endAt, item.start_at, item.end_at)
  );
  if (hasOverlap) {
    return NextResponse.json(
      { error: "Booking overlaps with an existing active/scheduled booking." },
      { status: 409 }
    );
  }

  const booking = await prisma.vehicleAssignment.create({
    data: {
      vehicle_id: vehicleId,
      assigned_to_user_id: assignedToUserId,
      start_at: startAt,
      end_at: endAt,
      note,
      created_by: user.id,
    },
  });

  return NextResponse.json({ data: booking }, { status: 201 });
}
