import { NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { isVehicleInWorkspace, parseWorkspaceParam } from "@/lib/workspace";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

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

export async function GET(request: Request, context: RouteContext) {
  const supabase = await createClient();
  const { id } = await context.params;
  const workspace = parseWorkspaceParam(
    new URL(request.url).searchParams.get("ws")
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let membership: { role: string } | null = null;
  if (workspace.type === "company") {
    membership = await prisma.companyMember.findFirst({
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
  }

  const vehicle = await prisma.vehicle.findUnique({
    where: { id },
    select: {
      id: true,
      user_id: true,
      owner_user_id: true,
      owner_company_id: true,
    },
  });

  if (!vehicle || !isVehicleInWorkspace(vehicle, workspace, user.id)) {
    return NextResponse.json({ error: "Vehicle not found." }, { status: 404 });
  }

  const assignments = await prisma.vehicleAssignment.findMany({
    where: {
      vehicle_id: id,
    },
    orderBy: {
      start_at: "desc",
    },
  });

  let members: { user_id: string; role: string }[] = [];
  if (workspace.type === "company") {
    members = await prisma.companyMember.findMany({
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
    });
  }

  const profileIds = Array.from(
    new Set([
      ...members.map((member) => member.user_id),
      ...assignments.map((assignment) => assignment.assigned_to_user_id),
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
    data: assignments.map((assignment) => ({
      ...assignment,
      assigned_to_name:
        profileById.get(assignment.assigned_to_user_id) ??
        (assignment.assigned_to_user_id === user.id ? "You" : "Member"),
    })),
    members: members.map((member) => ({
      ...member,
      display_name:
        profileById.get(member.user_id) ??
        (member.user_id === user.id ? "You" : "Member"),
    })),
    currentUserId: user.id,
    currentUserRole: membership?.role ?? "owner",
  });
}

export async function POST(request: Request, context: RouteContext) {
  const supabase = await createClient();
  const { id } = await context.params;
  const workspace = parseWorkspaceParam(
    new URL(request.url).searchParams.get("ws")
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let membership: { role: string } | null = null;
  if (workspace.type === "company") {
    membership = await prisma.companyMember.findFirst({
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
  }

  const vehicle = await prisma.vehicle.findUnique({
    where: { id },
    select: {
      id: true,
      user_id: true,
      owner_user_id: true,
      owner_company_id: true,
    },
  });

  if (!vehicle || !isVehicleInWorkspace(vehicle, workspace, user.id)) {
    return NextResponse.json({ error: "Vehicle not found." }, { status: 404 });
  }

  const body = await request.json();
  const assignedToUserId = String(body.assigned_to_user_id ?? user.id).trim();
  const startAt = parseDate(body.start_at);
  const endAt = parseDate(body.end_at);
  const note = typeof body.note === "string" ? body.note.trim() : null;

  if (!assignedToUserId || !startAt || !endAt || startAt >= endAt) {
    return NextResponse.json(
      { error: "Assigned user, valid start, and valid end are required." },
      { status: 400 }
    );
  }

  if (workspace.type === "personal") {
    if (assignedToUserId !== user.id) {
      return NextResponse.json(
        { error: "Personal workspace assignments can only be assigned to self." },
        { status: 403 }
      );
    }
  } else {
    const isAdminOrOwner =
      membership?.role === "owner" || membership?.role === "admin";
    if (!isAdminOrOwner && assignedToUserId !== user.id) {
      return NextResponse.json(
        { error: "Only admins can assign vehicles to other members." },
        { status: 403 }
      );
    }

    const targetMember = await prisma.companyMember.findFirst({
      where: {
        company_id: workspace.companyId,
        user_id: assignedToUserId,
      },
    });
    if (!targetMember) {
      return NextResponse.json(
        { error: "Assigned user is not a member of this company." },
        { status: 400 }
      );
    }
  }

  const conflictingAssignments = await prisma.vehicleAssignment.findMany({
    where: {
      vehicle_id: id,
      status: {
        in: ["scheduled", "active"],
      },
    },
    select: {
      start_at: true,
      end_at: true,
    },
  });

  const hasOverlap = conflictingAssignments.some((existing) =>
    overlapsRange(startAt, endAt, existing.start_at, existing.end_at)
  );

  if (hasOverlap) {
    return NextResponse.json(
      { error: "Assignment overlaps with an existing active/scheduled period." },
      { status: 409 }
    );
  }

  const assignment = await prisma.vehicleAssignment.create({
    data: {
      vehicle_id: id,
      assigned_to_user_id: assignedToUserId,
      start_at: startAt,
      end_at: endAt,
      note,
      created_by: user.id,
    },
  });

  return NextResponse.json(assignment);
}
