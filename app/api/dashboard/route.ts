import { NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { parseWorkspaceParam } from "@/lib/workspace";

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

type ComplianceItem = {
  vehicle_id: string;
  vehicle_name: string;
  vehicle_license_plate: string;
  type: "insurance" | "inspection" | "road_tax";
  due_at: string;
  is_overdue: boolean;
};

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

  const now = new Date();
  const soonDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday);
  endOfToday.setDate(endOfToday.getDate() + 1);
  const ownershipWhere = getOwnershipWhere(workspace, user.id);

  const [
    totalVehicles,
    activeAssignmentsNow,
    recentVehicles,
    urgentVehicles,
    todayAssignmentsRaw,
    unavailableVehicleRows,
  ] = await Promise.all([
    prisma.vehicle.count({ where: ownershipWhere }),
    prisma.vehicleAssignment.count({
      where: {
        status: { in: ["scheduled", "active"] },
        start_at: { lte: now },
        end_at: { gt: now },
        vehicle: ownershipWhere,
      },
    }),
    prisma.vehicle.findMany({
      where: ownershipWhere,
      select: {
        id: true,
        name: true,
        model: true,
        license_plate: true,
        updated_at: true,
      },
      orderBy: { updated_at: "desc" },
      take: 5,
    }),
    prisma.vehicle.findMany({
      where: {
        AND: [
          ownershipWhere,
          {
            OR: [
              { insurance_valid_until: { lte: soonDate } },
              { inspection_valid_until: { lte: soonDate } },
              { road_tax_valid_until: { lte: soonDate } },
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
      orderBy: { updated_at: "desc" },
    }),
    prisma.vehicleAssignment.findMany({
      where: {
        vehicle: ownershipWhere,
        OR: [
          {
            start_at: {
              gte: startOfToday,
              lt: endOfToday,
            },
          },
          {
            end_at: {
              gte: startOfToday,
              lt: endOfToday,
            },
          },
        ],
      },
      select: {
        id: true,
        vehicle_id: true,
        assigned_to_user_id: true,
        start_at: true,
        end_at: true,
        status: true,
        vehicle: {
          select: {
            name: true,
            model: true,
            license_plate: true,
          },
        },
      },
      orderBy: { start_at: "asc" },
      take: 10,
    }),
    prisma.vehicleAssignment.findMany({
      where: {
        status: { in: ["scheduled", "active"] },
        start_at: { lte: now },
        end_at: { gt: now },
        vehicle: ownershipWhere,
      },
      select: {
        vehicle_id: true,
      },
      distinct: ["vehicle_id"],
    }),
  ]);

  const unavailableNow = unavailableVehicleRows.length;
  const availableNow = Math.max(totalVehicles - unavailableNow, 0);

  const complianceItems: ComplianceItem[] = [];
  for (const vehicle of urgentVehicles) {
    const checks: Array<{
      key: ComplianceItem["type"];
      value: Date | null;
    }> = [
      { key: "insurance", value: vehicle.insurance_valid_until },
      { key: "inspection", value: vehicle.inspection_valid_until },
      { key: "road_tax", value: vehicle.road_tax_valid_until },
    ];

    for (const check of checks) {
      if (!check.value) continue;
      if (check.value > soonDate) continue;
      complianceItems.push({
        vehicle_id: vehicle.id,
        vehicle_name: vehicle.name,
        vehicle_license_plate: vehicle.license_plate,
        type: check.key,
        due_at: check.value.toISOString(),
        is_overdue: check.value < now,
      });
    }
  }

  complianceItems.sort((a, b) => {
    if (a.is_overdue !== b.is_overdue) return a.is_overdue ? -1 : 1;
    return new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
  });

  const overdueComplianceCount = complianceItems.filter((item) => item.is_overdue).length;
  const expiringSoonCount = complianceItems.filter((item) => !item.is_overdue).length;

  const assigneeIds = Array.from(
    new Set(todayAssignmentsRaw.map((item) => item.assigned_to_user_id))
  );
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

  const todayAssignments = todayAssignmentsRaw.map((assignment) => ({
    id: assignment.id,
    vehicle_id: assignment.vehicle_id,
    vehicle_name: assignment.vehicle.name,
    vehicle_model: assignment.vehicle.model,
    vehicle_license_plate: assignment.vehicle.license_plate,
    assigned_to_user_id: assignment.assigned_to_user_id,
    assigned_to_name:
      profileById.get(assignment.assigned_to_user_id) ??
      (assignment.assigned_to_user_id === user.id ? "You" : "Member"),
    start_at: assignment.start_at.toISOString(),
    end_at: assignment.end_at.toISOString(),
    status: assignment.status,
  }));

  return NextResponse.json({
    data: {
      kpis: {
        total_vehicles: totalVehicles,
        active_assignments_now: activeAssignmentsNow,
        available_now: availableNow,
        expiring_30_days: expiringSoonCount,
        overdue_compliance: overdueComplianceCount,
      },
      urgent_compliance: complianceItems.slice(0, 8),
      today_assignments: todayAssignments,
      recent_vehicles: recentVehicles.map((vehicle) => ({
        id: vehicle.id,
        name: vehicle.name,
        model: vehicle.model,
        license_plate: vehicle.license_plate,
        updated_at: vehicle.updated_at.toISOString(),
      })),
    },
  });
}
