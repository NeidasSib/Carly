import { NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{
    id: string;
    userId: string;
  }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  const supabase = await createClient();
  const { id, userId } = await context.params;

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

  if (!requesterMembership || !["owner", "admin"].includes(requesterMembership.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (userId === user.id) {
    return NextResponse.json(
      { error: "You cannot remove yourself from this endpoint." },
      { status: 400 }
    );
  }

  const target = await prisma.companyMember.findFirst({
    where: {
      company_id: id,
      user_id: userId,
    },
  });

  if (!target) {
    return NextResponse.json({ error: "Member not found." }, { status: 404 });
  }

  if (target.role === "owner" && requesterMembership.role !== "owner") {
    return NextResponse.json(
      { error: "Only an owner can remove another owner." },
      { status: 403 }
    );
  }

  await prisma.companyMember.delete({
    where: {
      id: target.id,
    },
  });

  return NextResponse.json({ success: true });
}
