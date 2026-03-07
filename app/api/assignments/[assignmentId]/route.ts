import { NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { isVehicleInWorkspace, parseWorkspaceParam } from "@/lib/workspace";

type RouteContext = {
  params: Promise<{
    assignmentId: string;
  }>;
};

function parseDate(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed;
}

export async function PATCH(request: Request, context: RouteContext) {
  const supabase = await createClient();
  const { assignmentId } = await context.params;
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

  const assignment = await prisma.vehicleAssignment.findUnique({
    where: { id: assignmentId },
    include: {
      vehicle: {
        select: {
          id: true,
          user_id: true,
          owner_user_id: true,
          owner_company_id: true,
        },
      },
    },
  });

  if (
    !assignment ||
    !isVehicleInWorkspace(assignment.vehicle, workspace, user.id)
  ) {
    return NextResponse.json({ error: "Assignment not found." }, { status: 404 });
  }

  const isAdminOrOwner =
    membership?.role === "owner" || membership?.role === "admin";
  if (workspace.type === "company" && !isAdminOrOwner) {
    if (assignment.assigned_to_user_id !== user.id) {
      return NextResponse.json(
        { error: "You can only update your own assignments." },
        { status: 403 }
      );
    }
  }

  const body = await request.json();
  const nextStatus =
    typeof body.status === "string" ? body.status.trim().toLowerCase() : undefined;
  const nextEndAt = parseDate(body.end_at);
  const nextNote =
    typeof body.note === "string" ? body.note.trim() : body.note === null ? null : undefined;

  if (
    nextStatus !== undefined &&
    !["scheduled", "active", "completed", "cancelled"].includes(nextStatus)
  ) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }

  if (nextEndAt === undefined) {
    return NextResponse.json({ error: "Invalid end date." }, { status: 400 });
  }

  if (nextEndAt && nextEndAt <= assignment.start_at) {
    return NextResponse.json(
      { error: "End date must be after start date." },
      { status: 400 }
    );
  }

  const updated = await prisma.vehicleAssignment.update({
    where: { id: assignmentId },
    data: {
      ...(nextStatus
        ? {
            status: nextStatus as
              | "scheduled"
              | "active"
              | "completed"
              | "cancelled",
          }
        : {}),
      ...(nextEndAt ? { end_at: nextEndAt } : {}),
      ...(nextNote !== undefined ? { note: nextNote } : {}),
    },
  });

  return NextResponse.json(updated);
}
