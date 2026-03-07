import { NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { isVehicleInWorkspace, parseWorkspaceParam } from "@/lib/workspace";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function normalizeVin(vin: unknown) {
  const value = String(vin ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
  return value || null;
}

function parseOptionalDate(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed;
}

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

function isStoragePath(value: string) {
  return value.length > 0 && !value.startsWith("http");
}

async function getSignedImageUrl(
  supabase: Awaited<ReturnType<typeof createClient>>,
  image: string,
) {
  if (!isStoragePath(image)) return image;

  const { data } = await supabase.storage
    .from("vehicle-photos")
    .createSignedUrl(image, 3600);
  return data?.signedUrl ?? "";
}

export async function GET(_request: Request, context: RouteContext) {
  const supabase = await createClient();
  const { id } = await context.params;
  const workspace = parseWorkspaceParam(new URL(_request.url).searchParams.get("ws"));

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

  const vehicle = await prisma.vehicle.findUnique({ where: { id } });

  if (!vehicle || !isVehicleInWorkspace(vehicle, workspace, user.id)) {
    return NextResponse.json({ error: "Vehicle not found." }, { status: 404 });
  }

  return NextResponse.json({
    ...vehicle,
    imageUrl: await getSignedImageUrl(supabase, vehicle.image),
  });
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

  const vehicle = await prisma.vehicle.findUnique({ where: { id } });

  if (!vehicle || !isVehicleInWorkspace(vehicle, workspace, user.id)) {
    return NextResponse.json({ error: "Vehicle not found." }, { status: 404 });
  }

  const body = await request.json();

  const name = String(body.name ?? "").trim();
  const model = String(body.model ?? "").trim();
  const licensePlate = String(body.license_plate ?? "").trim();
  const year = Number(body.year);
  const image = typeof body.image === "string" ? body.image.trim() : undefined;
  const vin = normalizeVin(body.vin);
  const insuranceValidUntil = parseOptionalDate(body.insurance_valid_until);
  const inspectionValidUntil = parseOptionalDate(body.inspection_valid_until);
  const roadTaxValidUntil = parseOptionalDate(body.road_tax_valid_until);

  if (!name || !licensePlate || Number.isNaN(year)) {
    return NextResponse.json(
      { error: "Name, year, and license plate are required." },
      { status: 400 },
    );
  }

  if (
    insuranceValidUntil === undefined ||
    inspectionValidUntil === undefined ||
    roadTaxValidUntil === undefined
  ) {
    return NextResponse.json(
      { error: "One or more date fields are invalid." },
      { status: 400 }
    );
  }

  if (image && isStoragePath(image) && image !== vehicle.image) {
    if (isStoragePath(vehicle.image)) {
      await supabase.storage.from("vehicle-photos").remove([vehicle.image]);
    }
  }

  try {
    const updated = await prisma.vehicle.update({
      where: { id: vehicle.id },
      data: {
        name,
        model,
        year,
        license_plate: licensePlate,
        vin,
        fuel_type:
          typeof body.fuel_type === "string" ? body.fuel_type.trim() || null : null,
        transmission:
          typeof body.transmission === "string"
            ? body.transmission.trim() || null
            : null,
        insurance_valid_until: insuranceValidUntil,
        inspection_valid_until: inspectionValidUntil,
        road_tax_valid_until: roadTaxValidUntil,
        ...(image ? { image } : {}),
      },
    });

    return NextResponse.json({
      ...updated,
      imageUrl: await getSignedImageUrl(supabase, updated.image),
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return NextResponse.json(
        { error: "VIN must be unique." },
        { status: 409 }
      );
    }
    throw error;
  }
}
