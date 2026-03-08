import { redirect } from "next/navigation";

import prisma from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import SetupProfileForm from "@/components/setup-profile-form";

export default async function SetupProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
  });

  if (profile?.display_name) {
    redirect("/dashboard");
  }

  return <SetupProfileForm initialDisplayName={user.user_metadata?.name ?? ""} />;
}
