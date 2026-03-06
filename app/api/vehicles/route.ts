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
  if (typeof body.image !== "string" || !body.image.trim()) {
    return NextResponse.json(
      { error: "Vehicle photo is required." },
      { status: 400 }
    );
  }

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
  const rawQuery = searchParams.get("q") ?? "";
  const query = rawQuery.trim();

  const safePage = Number.isNaN(page) || page < 1 ? 1 : page;
  const safeLimit =
    Number.isNaN(limit) || limit < 1 ? 10 : Math.min(limit, 100);

  const skip = (safePage - 1) * safeLimit;
  const parsedYear = Number(query);
  const isYearSearch = query.length > 0 && !Number.isNaN(parsedYear);

  const where = {
    user_id: user.id,
    ...(query
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
            ...(isYearSearch ? [{ year: parsedYear }] : []),
          ],
        }
      : {}),
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

  if (!id) {
    return NextResponse.json(
      { error: "Vehicle id is required." },
      { status: 400 }
    );
  }

  const vehicle = await prisma.vehicle.findFirst({
    where: {
      id,
      user_id: user.id,
    },
    select: {
      id: true,
      image: true,
    },
  });

  if (!vehicle) {
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
