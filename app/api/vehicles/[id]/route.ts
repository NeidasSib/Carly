import { NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const vehicle = await prisma.vehicle.findFirst({
    where: {
      id,
      user_id: user.id,
    },
  });

  if (!vehicle) {
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const vehicle = await prisma.vehicle.findFirst({
    where: {
      id,
      user_id: user.id,
    },
  });

  if (!vehicle) {
    return NextResponse.json({ error: "Vehicle not found." }, { status: 404 });
  }

  const body = await request.json();

  const name = String(body.name ?? "").trim();
  const model = String(body.model ?? "").trim();
  const licensePlate = String(body.license_plate ?? "").trim();
  const year = Number(body.year);
  const image = typeof body.image === "string" ? body.image.trim() : undefined;

  if (!name || !licensePlate || Number.isNaN(year)) {
    return NextResponse.json(
      { error: "Name, year, and license plate are required." },
      { status: 400 },
    );
  }

  if (image && isStoragePath(image) && image !== vehicle.image) {
    if (isStoragePath(vehicle.image)) {
      await supabase.storage.from("vehicle-photos").remove([vehicle.image]);
    }
  }

  const updated = await prisma.vehicle.update({
    where: { id: vehicle.id },
    data: {
      name,
      model,
      year,
      license_plate: licensePlate,
      ...(image ? { image } : {}),
    },
  });

  return NextResponse.json({
    ...updated,
    imageUrl: await getSignedImageUrl(supabase, updated.image),
  });
}
