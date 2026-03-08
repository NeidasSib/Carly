import { NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import { hashToken } from "@/lib/security";
import { createClient } from "@/lib/supabase/server";

function roleRank(role: "owner" | "admin" | "member") {
  switch (role) {
    case "owner":
      return 3;
    case "admin":
      return 2;
    case "member":
    default:
      return 1;
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const rawToken = String(body.token ?? "").trim();
  if (!rawToken) {
    return NextResponse.json({ error: "Invite token is required." }, { status: 400 });
  }
  const tokenHash = hashToken(rawToken);
  const now = new Date();

  const invite = await prisma.companyInvite.findFirst({
    where: {
      OR: [{ token: tokenHash }, { token: rawToken }],
    },
  });

  if (
    !invite ||
    invite.used_at ||
    invite.revoked_at ||
    invite.expires_at <= now
  ) {
    return NextResponse.json(
      { error: "Invitation is invalid or expired." },
      { status: 404 }
    );
  }

  const consumed = await prisma.companyInvite.updateMany({
    where: {
      id: invite.id,
      used_at: null,
      revoked_at: null,
      expires_at: {
        gt: now,
      },
    },
    data: {
      used_at: now,
      used_by_user_id: user.id,
    },
  });

  if (consumed.count !== 1) {
    return NextResponse.json(
      { error: "Invitation has already been used or expired." },
      { status: 409 }
    );
  }

  const existingMembership = await prisma.companyMember.findFirst({
    where: {
      company_id: invite.company_id,
      user_id: user.id,
    },
  });

  if (existingMembership) {
    const bestRole =
      roleRank(existingMembership.role) >= roleRank(invite.role)
        ? existingMembership.role
        : invite.role;

    await prisma.companyMember.update({
      where: { id: existingMembership.id },
      data: {
        role: bestRole,
      },
    });
  } else {
    await prisma.companyMember.create({
      data: {
        company_id: invite.company_id,
        user_id: user.id,
        role: invite.role,
      },
    });
  }

  const company = await prisma.company.findUnique({
    where: { id: invite.company_id },
    select: { id: true, name: true },
  });

  return NextResponse.json({
    success: true,
    company,
    workspace: `company:${invite.company_id}`,
  });
}
