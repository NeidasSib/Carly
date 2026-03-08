import { NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import { isDemoUser } from "@/lib/demo";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  const supabase = await createClient();
  const { id } = await context.params;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const requesterMembership = await prisma.companyMember.findFirst({
    where: {
      company_id: id,
      user_id: user.id,
    },
  });

  if (!requesterMembership || requesterMembership.role !== "owner") {
    return NextResponse.json(
      { error: "Only a company owner can delete the company." },
      { status: 403 }
    );
  }

  if (isDemoUser(user.email)) {
    return NextResponse.json(
      { error: "Demo accounts cannot delete companies." },
      { status: 403 }
    );
  }

  await prisma.$transaction([
    prisma.vehicle.updateMany({
      where: {
        owner_company_id: id,
      },
      data: {
        owner_company_id: null,
        owner_user_id: user.id,
      },
    }),
    prisma.company.delete({
      where: {
        id,
      },
    }),
  ]);

  return NextResponse.json({ success: true });
}
