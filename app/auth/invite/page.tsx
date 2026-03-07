"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";

async function getResponseErrorMessage(res: Response) {
  try {
    const data = await res.json();
    if (typeof data?.error === "string" && data.error.trim()) {
      return data.error;
    }
    return `Request failed with status ${res.status}.`;
  } catch {
    return `Request failed with status ${res.status}.`;
  }
}

export default function AcceptInvitePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token")?.trim() ?? "";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loginHref = useMemo(() => {
    const next = `/auth/invite?token=${encodeURIComponent(token)}`;
    return `/auth/login?next=${encodeURIComponent(next)}`;
  }, [token]);

  async function acceptInvite() {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push(loginHref);
        return;
      }

      const res = await fetch("/api/companies/invitations/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      if (!res.ok) {
        setError(await getResponseErrorMessage(res));
        return;
      }

      const data = (await res.json()) as { workspace: string };
      router.push(`/dashboard?ws=${encodeURIComponent(data.workspace)}`);
      router.refresh();
    } catch {
      setError("Failed to accept invitation.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>Company invitation</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {!token ? (
              <p className="text-sm text-muted-foreground">
                This invite link is missing a token.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Accept this one-time link to join the company workspace.
              </p>
            )}

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            <div className="flex gap-2">
              <Button type="button" disabled={!token || busy} onClick={acceptInvite}>
                {busy ? "Joining..." : "Accept invitation"}
              </Button>
              <Button asChild type="button" variant="outline">
                <Link href={loginHref}>Login first</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
