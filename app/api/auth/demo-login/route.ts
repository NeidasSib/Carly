import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const DEMO_LOGIN_MAX_PER_MINUTE = 5;
const WINDOW_MS = 60 * 1000;

const rateLimitMap = new Map<
  string,
  { count: number; resetAt: number }
>();

function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry) return false;
  if (now >= entry.resetAt) {
    rateLimitMap.delete(ip);
    return false;
  }
  return entry.count >= DEMO_LOGIN_MAX_PER_MINUTE;
}

function recordAttempt(ip: string): void {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now >= entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }
  entry.count += 1;
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many demo login attempts. Please try again in a minute." },
      { status: 429 }
    );
  }

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

  recordAttempt(ip);

  return NextResponse.json({
    data: {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    },
  });
}
