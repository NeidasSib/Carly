import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { isVehicleInWorkspace, parseWorkspaceParam } from "@/lib/workspace";

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

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const body = await request.json();
  const workspace = parseWorkspaceParam(
    searchParams.get("ws") ?? body.workspace ?? "personal"
  );

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
  if (typeof body.image !== "string" || !body.image.trim()) {
    return NextResponse.json(
      { error: "Vehicle photo is required." },
      { status: 400 }
    );
  }

  const insuranceValidUntil = parseOptionalDate(body.insurance_valid_until);
  const inspectionValidUntil = parseOptionalDate(body.inspection_valid_until);
  const roadTaxValidUntil = parseOptionalDate(body.road_tax_valid_until);

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

  try {
    const vehicle = await prisma.vehicle.create({
      data: {
        name: body.name,
        model: body.model,
        year: Number(body.year),
        license_plate: body.license_plate,
        image: body.image ?? "",
        user_id: user.id,
        owner_user_id: workspace.type === "personal" ? user.id : null,
        owner_company_id:
          workspace.type === "company" ? workspace.companyId : null,
        vin: normalizeVin(body.vin),
        fuel_type:
          typeof body.fuel_type === "string" ? body.fuel_type.trim() || null : null,
        transmission:
          typeof body.transmission === "string"
            ? body.transmission.trim() || null
            : null,
        insurance_valid_until: insuranceValidUntil,
        inspection_valid_until: inspectionValidUntil,
        road_tax_valid_until: roadTaxValidUntil,
      },
    });

    return NextResponse.json(vehicle);
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

export async function GET(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);

  const page = Number(searchParams.get("page") ?? "1");
  const limit = Number(searchParams.get("limit") ?? "10");
  const rawQuery = searchParams.get("q") ?? "";
  const query = rawQuery.trim();
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

  const safePage = Number.isNaN(page) || page < 1 ? 1 : page;
  const safeLimit =
    Number.isNaN(limit) || limit < 1 ? 10 : Math.min(limit, 100);

  const skip = (safePage - 1) * safeLimit;
  const parsedYear = Number(query);
  const isYearSearch = query.length > 0 && !Number.isNaN(parsedYear);

  const ownershipWhere =
    workspace.type === "company"
      ? {
          owner_company_id: workspace.companyId,
        }
      : {
          OR: [
            {
              owner_user_id: user.id,
              owner_company_id: null,
            },
            {
              owner_user_id: null,
              owner_company_id: null,
              user_id: user.id,
            },
          ],
        };

  const searchWhere = query
    ? {
        OR: [
          {
            name: {
              contains: query,
              mode: "insensitive" as const,
            },
          },
          {
            model: {
              contains: query,
              mode: "insensitive" as const,
            },
          },
          {
            license_plate: {
              contains: query,
              mode: "insensitive" as const,
            },
          },
          {
            vin: {
              contains: query,
              mode: "insensitive" as const,
            },
          },
          ...(isYearSearch ? [{ year: parsedYear }] : []),
        ],
      }
    : {};

  const where = {
    AND: [ownershipWhere, ...(query ? [searchWhere] : [])],
  };

  const [vehicles, total] = await Promise.all([
    prisma.vehicle.findMany({
      where,
      skip,
      take: safeLimit,
      orderBy: {
        created_at: "desc",
      },
    }),
    prisma.vehicle.count({
      where,
    }),
  ]);

  const vehiclesWithImageUrls = await Promise.all(
    vehicles.map(async (v) => {
      if (!v.image || v.image.startsWith("http")) {
        return v;
      }
      const { data } = await supabase.storage
        .from("vehicle-photos")
        .createSignedUrl(v.image, 3600);
      return { ...v, image: data?.signedUrl ?? v.image };
    })
  );

  return NextResponse.json({
    data: vehiclesWithImageUrls,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit),
      hasNextPage: safePage * safeLimit < total,
      hasPreviousPage: safePage > 1,
    },
  });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = (searchParams.get("id") ?? "").trim();
  const workspace = parseWorkspaceParam(searchParams.get("ws"));

  if (!id) {
    return NextResponse.json(
      { error: "Vehicle id is required." },
      { status: 400 }
    );
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
    where: {
      id,
    },
    select: {
      id: true,
      image: true,
      user_id: true,
      owner_user_id: true,
      owner_company_id: true,
    },
  });

  if (!vehicle || !isVehicleInWorkspace(vehicle, workspace, user.id)) {
    return NextResponse.json({ error: "Vehicle not found." }, { status: 404 });
  }

  if (vehicle.image && !vehicle.image.startsWith("http")) {
    const { error: storageError } = await supabase.storage
      .from("vehicle-photos")
      .remove([vehicle.image]);

    if (
      storageError &&
      !storageError.message.toLowerCase().includes("not found")
    ) {
      return NextResponse.json(
        { error: `Failed to delete vehicle photo: ${storageError.message}` },
        { status: 500 }
      );
    }
  }

  await prisma.vehicle.delete({
    where: {
      id: vehicle.id,
    },
  });

  return NextResponse.json({ success: true });
}
