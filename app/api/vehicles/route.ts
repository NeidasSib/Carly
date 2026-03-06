import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json();

  const vehicle = await prisma.vehicle.create({
    data: {
      name: body.name,
      model: body.model,
      year: Number(body.year),
      license_plate: body.license_plate,
      image: body.image ?? "",
      user_id: user.id,
    },
  });

  return NextResponse.json(vehicle);
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

  const safePage = Number.isNaN(page) || page < 1 ? 1 : page;
  const safeLimit =
    Number.isNaN(limit) || limit < 1 ? 10 : Math.min(limit, 100);

  const skip = (safePage - 1) * safeLimit;

  const [vehicles, total] = await Promise.all([
    prisma.vehicle.findMany({
      where: {
        user_id: user.id,
      },
      skip,
      take: safeLimit,
      orderBy: {
        created_at: "desc",
      },
    }),
    prisma.vehicle.count({
      where: {
        user_id: user.id,
      },
    }),
  ]);

  return NextResponse.json({
    data: vehicles,
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
