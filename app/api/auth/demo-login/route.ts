import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST() {
  const demoEmail = process.env.DEMO_LOGIN_EMAIL;
  const demoPassword = process.env.DEMO_LOGIN_PASSWORD;

  if (!demoEmail || !demoPassword) {
    return NextResponse.json(
      {
        error:
          "Demo login is not configured. Set DEMO_LOGIN_EMAIL and DEMO_LOGIN_PASSWORD.",
      },
      { status: 503 }
    );
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  const { data, error } = await supabase.auth.signInWithPassword({
    email: demoEmail,
    password: demoPassword,
  });

  if (error || !data.session) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to start demo session." },
      { status: 401 }
    );
  }

  return NextResponse.json({
    data: {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    },
  });
}
