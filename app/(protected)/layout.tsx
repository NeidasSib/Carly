import { ReactNode } from "react";
import { redirect } from "next/navigation";

import { ProtectedShell } from "./protected-shell";
import prisma from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

export default async function ProtectedLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
    select: { id: true },
  });

  if (!profile) {
    redirect("/auth/setup-profile");
  }

  return <ProtectedShell>{children}</ProtectedShell>;
}
