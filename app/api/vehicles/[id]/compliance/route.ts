import { NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { isVehicleInWorkspace, parseWorkspaceParam } from "@/lib/workspace";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type ComplianceType = "insurance" | "inspection" | "road_tax";

function getComplianceColumn(type: ComplianceType) {
  switch (type) {
    case "insurance":
      return "insurance_valid_until";
    case "inspection":
      return "inspection_valid_until";
    case "road_tax":
    default:
      return "road_tax_valid_until";
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const supabase = await createClient();
  const { id } = await context.params;
  const workspace = parseWorkspaceParam(new URL(request.url).searchParams.get("ws"));

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
  const type = String(body.type ?? "").trim() as ComplianceType;
  const dueAtRaw = String(body.due_at ?? "").trim();

  if (!["insurance", "inspection", "road_tax"].includes(type)) {
    return NextResponse.json({ error: "Invalid compliance type." }, { status: 400 });
  }
  if (!dueAtRaw) {
    return NextResponse.json({ error: "Due date is required." }, { status: 400 });
  }

  const parsed = new Date(dueAtRaw);
  if (Number.isNaN(parsed.getTime())) {
    return NextResponse.json({ error: "Invalid due date." }, { status: 400 });
  }

  const column = getComplianceColumn(type);
  const updated = await prisma.vehicle.update({
    where: { id: vehicle.id },
    data: {
      [column]: parsed,
    },
    select: {
      id: true,
      insurance_valid_until: true,
      inspection_valid_until: true,
      road_tax_valid_until: true,
      updated_at: true,
    },
  });

  return NextResponse.json({ data: updated });
}
