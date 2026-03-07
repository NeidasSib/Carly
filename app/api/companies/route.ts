import { NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const memberships = await prisma.companyMember.findMany({
    where: { user_id: user.id },
    include: {
      company: {
        select: {
          id: true,
          name: true,
          created_by: true,
          created_at: true,
          updated_at: true,
        },
      },
    },
    orderBy: { created_at: "asc" },
  });

  return NextResponse.json({
    data: memberships.map((membership) => ({
      ...membership.company,
      role: membership.role,
    })),
  });
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
  const name = String(body.name ?? "").trim();

  if (!name) {
    return NextResponse.json(
      { error: "Company name is required." },
      { status: 400 }
    );
  }

  const company = await prisma.company.create({
    data: {
      name,
      created_by: user.id,
      members: {
        create: {
          user_id: user.id,
          role: "owner",
        },
      },
    },
  });

  return NextResponse.json(company, { status: 201 });
}
