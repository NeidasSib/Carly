import { randomBytes } from "crypto";
import { NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import { hashToken } from "@/lib/security";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const supabase = await createClient();
  const { id } = await context.params;
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

  const invites = await prisma.companyInvite.findMany({
    where: {
      company_id: id,
      used_at: null,
      revoked_at: null,
      expires_at: {
        gt: new Date(),
      },
    },
    orderBy: {
      created_at: "desc",
    },
    select: {
      id: true,
      company_id: true,
      role: true,
      expires_at: true,
      created_at: true,
    },
  });

  return NextResponse.json({ data: invites });
}

export async function POST(request: Request, context: RouteContext) {
  const supabase = await createClient();
  const { id } = await context.params;
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

  const body = await request.json();
  const role =
    typeof body.role === "string" ? body.role.trim().toLowerCase() : "member";
  if (!["owner", "admin", "member"].includes(role)) {
    return NextResponse.json({ error: "Invalid role." }, { status: 400 });
  }

  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);
  const invite = await prisma.companyInvite.create({
    data: {
      company_id: id,
      token: tokenHash,
      role: role as "owner" | "admin" | "member",
      created_by: user.id,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  const origin = new URL(request.url).origin;
  const inviteLink = `${origin}/auth/invite?token=${encodeURIComponent(rawToken)}`;

  return NextResponse.json({
    data: {
      id: invite.id,
      company_id: invite.company_id,
      role: invite.role,
      expires_at: invite.expires_at,
      created_at: invite.created_at,
      invite_link: inviteLink,
    },
  });
}
