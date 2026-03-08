import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import prisma from "@/lib/prisma";
import { isDemoUser } from "@/lib/demo";
import { createClient } from "@/lib/supabase/server";

const AVATAR_BUCKET = "vehicle-photos";

function isPrivateStoragePath(value: string | null | undefined): value is string {
  return Boolean(value && value.startsWith("private/"));
}

async function createSignedAvatarUrl(path: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .createSignedUrl(path, 60 * 60);
  if (error) return null;
  return data.signedUrl;
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
  });

  if (!profile) {
    return NextResponse.json({ data: null });
  }

  const avatar_signed_url = isPrivateStoragePath(profile.avatar_url)
    ? await createSignedAvatarUrl(profile.avatar_url)
    : null;

  return NextResponse.json({
    data: {
      ...profile,
      avatar_signed_url,
    },
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
  const displayName = String(body.display_name ?? "").trim();
  const avatarUrlRaw =
    typeof body.avatar_url === "string" ? body.avatar_url.trim() : "";
  const avatarUrl = avatarUrlRaw ? avatarUrlRaw : null;

  if (!displayName) {
    return NextResponse.json(
      { error: "Display name is required." },
      { status: 400 }
    );
  }

  const existingProfile = await prisma.profile.findUnique({
    where: { id: user.id },
    select: { avatar_url: true },
  });

  const profile = await prisma.profile.upsert({
    where: { id: user.id },
    create: {
      id: user.id,
      display_name: displayName,
      avatar_url: avatarUrl,
    },
    update: {
      display_name: displayName,
      avatar_url: avatarUrl,
    },
  });

  if (
    existingProfile?.avatar_url &&
    existingProfile.avatar_url !== profile.avatar_url &&
    isPrivateStoragePath(existingProfile.avatar_url)
  ) {
    await supabase.storage.from(AVATAR_BUCKET).remove([existingProfile.avatar_url]);
  }

  const avatar_signed_url = isPrivateStoragePath(profile.avatar_url)
    ? await createSignedAvatarUrl(profile.avatar_url)
    : null;

  return NextResponse.json({
    data: {
      ...profile,
      avatar_signed_url,
    },
  });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (isDemoUser(user.email)) {
    return NextResponse.json(
      { error: "Demo accounts cannot be deleted." },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const password = String(body?.password ?? "").trim();
  if (!password) {
    return NextResponse.json(
      { error: "Please confirm your password before deleting your account." },
      { status: 400 }
    );
  }
  if (!user.email) {
    return NextResponse.json(
      {
        error:
          "This account has no email password login. Re-auth is required before delete.",
      },
      { status: 400 }
    );
  }

  const verifyClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
  const { error: verifyError } = await verifyClient.auth.signInWithPassword({
    email: user.email,
    password,
  });
  if (verifyError) {
    return NextResponse.json(
      { error: "Password is incorrect." },
      { status: 401 }
    );
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return NextResponse.json(
      {
        error:
          "Account deletion is not configured. Set SUPABASE_SERVICE_ROLE_KEY first.",
      },
      { status: 500 }
    );
  }

  const ownedMemberships = await prisma.companyMember.findMany({
    where: {
      user_id: user.id,
      role: "owner",
    },
    include: {
      company: {
        select: {
          id: true,
          name: true,
          members: {
            where: { role: "owner" },
            select: { id: true },
          },
        },
      },
    },
  });

  const solelyOwnedCompanies = ownedMemberships
    .filter((membership) => membership.company.members.length <= 1)
    .map((membership) => membership.company.name);

  if (solelyOwnedCompanies.length > 0) {
    return NextResponse.json(
      {
        error: `Transfer ownership or delete company first: ${solelyOwnedCompanies.join(", ")}`,
      },
      { status: 400 }
    );
  }

  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
    select: { avatar_url: true },
  });

  await prisma.$transaction([
    prisma.companyMember.deleteMany({ where: { user_id: user.id } }),
    prisma.vehicleAssignment.deleteMany({
      where: {
        OR: [{ assigned_to_user_id: user.id }, { created_by: user.id }],
      },
    }),
    prisma.vehicle.deleteMany({
      where: {
        OR: [{ owner_user_id: user.id }, { user_id: user.id }],
      },
    }),
    prisma.profile.deleteMany({ where: { id: user.id } }),
  ]);

  if (profile?.avatar_url && isPrivateStoragePath(profile.avatar_url)) {
    await supabase.storage.from(AVATAR_BUCKET).remove([profile.avatar_url]);
  }

  const adminClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey
  );
  const { error: deleteAuthError } = await adminClient.auth.admin.deleteUser(user.id);
  if (deleteAuthError) {
    return NextResponse.json(
      { error: `App data removed, but auth delete failed: ${deleteAuthError.message}` },
      { status: 500 }
    );
  }

  await supabase.auth.signOut();

  return NextResponse.json({ success: true });
}
