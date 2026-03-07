import { NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{
    id: string;
    inviteId: string;
  }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  const supabase = await createClient();
  const { id, inviteId } = await context.params;
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const membership = await prisma.companyMember.findFirst({
    where: {
      company_id: id,
      user_id: user.id,
    },
  });
  if (!membership || !["owner", "admin"].includes(membership.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const invite = await prisma.companyInvite.findFirst({
    where: {
      id: inviteId,
      company_id: id,
    },
  });

  if (!invite) {
    return NextResponse.json({ error: "Invite not found." }, { status: 404 });
  }

  await prisma.companyInvite.update({
    where: { id: invite.id },
    data: {
      revoked_at: new Date(),
    },
  });

  return NextResponse.json({ success: true });
}
