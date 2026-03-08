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
    where: {
      user_id: user.id,
    },
    include: {
      company: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: {
      created_at: "asc",
    },
  });

  return NextResponse.json({
    data: [
      { id: "personal", type: "personal", name: "Personal" as const },
      ...memberships.map((membership) => ({
        id: `company:${membership.company.id}`,
        type: "company" as const,
        name: membership.company.name,
        role: membership.role,
      })),
    ],
  });
}
