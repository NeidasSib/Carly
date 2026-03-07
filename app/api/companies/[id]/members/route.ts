import { NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

async function getMembership(companyId: string, userId: string) {
  return prisma.companyMember.findFirst({
    where: {
      company_id: companyId,
      user_id: userId,
    },
  });
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

  const membership = await getMembership(id, user.id);
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const members = await prisma.companyMember.findMany({
    where: { company_id: id },
    orderBy: { created_at: "asc" },
  });
  const profiles = await prisma.profile.findMany({
    where: {
      id: {
        in: members.map((member) => member.user_id),
      },
    },
    select: {
      id: true,
      display_name: true,
    },
  });
  const profileById = new Map(
    profiles.map((profile) => [profile.id, profile.display_name])
  );

  return NextResponse.json({
    data: members.map((member) => ({
      ...member,
      display_name:
        profileById.get(member.user_id) ??
        (member.user_id === user.id ? "You" : "Member"),
    })),
    currentUserRole: membership.role,
    currentUserId: user.id,
  });
}

export async function POST(request: Request, context: RouteContext) {
  await request.json().catch(() => null);
  await context.params;
  return NextResponse.json(
    {
      error:
        "Manual member add by user id is disabled. Use one-time invitation links.",
    },
    { status: 410 }
  );
}
